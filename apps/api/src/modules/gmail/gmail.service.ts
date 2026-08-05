import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimePublisher } from '../websocket/services/realtime-publisher.service';

// Keywords to detect job-related emails
const JOB_KEYWORDS = [
  'lamaran',
  'application',
  'lowongan',
  'job offer',
  'interview',
  'wawancara',
  'rekrutmen',
  'recruitment',
  'hiring',
  'shortlisted',
  'selected',
  'rejected',
  'ditolak',
  'tidak lolos',
  'lolos',
  'undangan',
  'invitation',
  'screening',
  'hr',
  'human resource',
  'talent acquisition',
  'onboarding',
  'offering',
  'salary',
  'gaji',
  'kontrak',
  'contract',
  'bergabung',
  'join us',
  'congratulations',
  'selamat',
  'kami informasikan',
  'kami sampaikan',
  'test online',
  'assessmen',
  'assessment',
];

const EMAIL_TYPE_KEYWORDS: Record<string, string[]> = {
  INTERVIEW: [
    'interview',
    'wawancara',
    'undangan wawancara',
    'invitation for interview',
    'schedule an interview',
  ],
  OFFER: [
    'job offer',
    'penawaran kerja',
    'offer letter',
    'salary offer',
    'bergabung bersama kami',
  ],
  REJECTED: [
    'rejected',
    'ditolak',
    'tidak lolos',
    'not selected',
    'unfortunately',
    'tidak memenuhi',
    'kami menyesal',
  ],
  SCREENING: [
    'screening',
    'shortlisted',
    'lolos seleksi',
    'test online',
    'assessmen',
    'psikotes',
  ],
  APPLIED_CONFIRM: [
    'diterima',
    'received',
    'application received',
    'lamaran diterima',
    'thank you for applying',
  ],
};

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimePublisher,
  ) {}

  createOAuth2Client(): any {
    return new google.auth.OAuth2(
      this.config.get<string>('GOOGLE_CLIENT_ID'),
      this.config.get<string>('GOOGLE_CLIENT_SECRET'),
      this.config.get<string>('GOOGLE_REDIRECT_URI'),
    );
  }

  getAuthUrl(userId: string): string {
    const oauth2Client = this.createOAuth2Client();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state: userId,
    });
  }

  async handleCallback(code: string, userId: string): Promise<void> {
    const oauth2Client = this.createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user's Gmail email
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const gmailEmail = profile.data.emailAddress || '';
    const historyId = profile.data.historyId?.toString();

    await this.prisma.gmailToken.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token!,
        tokenType: tokens.token_type || 'Bearer',
        scope: tokens.scope || '',
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        gmailEmail,
        historyId,
        isActive: true,
      },
      update: {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ? tokens.refresh_token : undefined,
        tokenType: tokens.token_type || 'Bearer',
        scope: tokens.scope || '',
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        gmailEmail,
        historyId,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    this.logger.log(
      `Gmail connected for userId=${userId}, email=${gmailEmail}`,
    );

    // Run initial sync
    await this.syncEmails(userId);
  }

  async disconnectGmail(userId: string): Promise<void> {
    await this.prisma.gmailToken.updateMany({
      where: { userId },
      data: { isActive: false },
    });
  }

  async getConnectionStatus(userId: string): Promise<{
    connected: boolean;
    gmailEmail?: string;
    lastSyncAt?: Date;
    unreadCount: number;
  }> {
    const token = await this.prisma.gmailToken.findUnique({
      where: { userId },
    });
    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return {
      connected: !!token?.isActive,
      gmailEmail: token?.gmailEmail,
      lastSyncAt: token?.lastSyncAt || undefined,
      unreadCount,
    };
  }

  async syncEmails(
    userId: string,
  ): Promise<{ newMessages: number; jobRelated: number }> {
    const tokenRecord = await this.prisma.gmailToken.findUnique({
      where: { userId },
    });
    if (!tokenRecord || !tokenRecord.isActive) {
      return { newMessages: 0, jobRelated: 0 };
    }

    const oauth2Client = this.createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: tokenRecord.accessToken,
      refresh_token: tokenRecord.refreshToken,
      token_type: tokenRecord.tokenType,
      expiry_date: tokenRecord.expiryDate?.getTime(),
    });

    // Auto-refresh token
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await this.prisma.gmailToken.update({
          where: { userId },
          data: {
            accessToken: tokens.access_token,
            expiryDate: tokens.expiry_date
              ? new Date(tokens.expiry_date)
              : null,
          },
        });
      }
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch last 50 messages in INBOX (only those not yet synced)
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['INBOX'],
      maxResults: 50,
    });

    const messages = listRes.data.messages || [];
    let newMessages = 0;
    let jobRelated = 0;

    for (const msg of messages) {
      if (!msg.id) continue;

      // Skip already processed
      const existing = await this.prisma.emailMessage.findUnique({
        where: { userId_gmailMessageId: { userId, gmailMessageId: msg.id } },
      });
      if (existing) continue;

      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'To', 'Date'],
        });

        const headers = detail.data.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
            ?.value || '';

        const subject = getHeader('Subject') || '(no subject)';
        const fromRaw = getHeader('From');
        const toRaw = getHeader('To');
        const dateStr = getHeader('Date');
        const snippet = detail.data.snippet || '';
        const threadId = detail.data.threadId || msg.id;

        // Parse from email/name
        const fromMatch = fromRaw.match(/^(?:"?(.+?)"?\s)?<?([^>]+)>?$/);
        const fromName = fromMatch?.[1]?.trim() || null;
        const fromEmail = fromMatch?.[2]?.trim() || fromRaw;

        const receivedAt = dateStr ? new Date(dateStr) : new Date();

        // Detect if job-related
        const searchText = `${subject} ${snippet} ${fromEmail}`.toLowerCase();
        const isJobRelated = JOB_KEYWORDS.some((k) =>
          searchText.includes(k.toLowerCase()),
        );

        // Detect email type
        let detectedType: string | null = null;
        if (isJobRelated) {
          for (const [type, keywords] of Object.entries(EMAIL_TYPE_KEYWORDS)) {
            if (keywords.some((k) => searchText.includes(k.toLowerCase()))) {
              detectedType = type;
              break;
            }
          }
        }

        await this.prisma.emailMessage.create({
          data: {
            userId,
            gmailMessageId: msg.id,
            gmailThreadId: threadId,
            subject,
            fromEmail,
            fromName,
            toEmail: toRaw,
            snippet,
            receivedAt,
            isJobRelated,
            detectedType,
          },
        });

        newMessages++;

        // Create notification if job-related
        if (isJobRelated) {
          jobRelated++;

          const typeLabel: Record<string, string> = {
            INTERVIEW: 'Undangan Interview',
            OFFER: 'Job Offer Diterima',
            REJECTED: 'Lamaran Ditolak',
            SCREENING: 'Lolos Screening',
            APPLIED_CONFIRM: 'Lamaran Dikonfirmasi',
          };

          const notifTitle = detectedType
            ? typeLabel[detectedType] || 'Email Loker Baru'
            : 'Email Loker Baru';
          const notifBody = `Dari: ${fromName || fromEmail}\nSubjek: ${subject}\n${snippet.substring(0, 200)}`;

          const notif = await this.prisma.notification.create({
            data: {
              userId,
              type: detectedType || 'EMAIL_JOB',
              title: notifTitle,
              body: notifBody,
              metadata: {
                gmailMessageId: msg.id,
                fromEmail,
                fromName,
                subject,
                detectedType,
              },
            },
          });

          // Push real-time notification via WebSocket to user's personal room
          this.realtime.emitToRoom(`user:${userId}`, 'notification:new', {
            id: notif.id,
            type: notif.type,
            title: notif.title,
            body: notif.body,
            metadata: notif.metadata,
            createdAt: notif.createdAt,
          });
        }
      } catch (err: any) {
        this.logger.warn(`Failed to process message ${msg.id}: ${err.message}`);
      }
    }

    // Update lastSyncAt
    await this.prisma.gmailToken.update({
      where: { userId },
      data: { lastSyncAt: new Date() },
    });

    this.logger.log(
      `Gmail sync for userId=${userId}: ${newMessages} new, ${jobRelated} job-related`,
    );
    return { newMessages, jobRelated };
  }

  async getEmailMessages(userId: string, jobRelatedOnly = false, limit = 30) {
    return this.prisma.emailMessage.findMany({
      where: {
        userId,
        ...(jobRelatedOnly ? { isJobRelated: true } : {}),
      },
      orderBy: { receivedAt: 'desc' },
      take: limit,
    });
  }

  async getNotifications(userId: string, limit = 50) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async markNotificationRead(
    notificationId: string,
    userId: string,
  ): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
