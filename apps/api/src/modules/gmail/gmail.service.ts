import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimePublisher } from '../websocket/services/realtime-publisher.service';

// Helper function for strict keyword matching (handles short keywords like 'hr' with word boundaries)
function isKeywordMatched(text: string, keyword: string): boolean {
  const cleanKeyword = keyword.toLowerCase().trim();
  if (cleanKeyword.length <= 4) {
    const escaped = cleanKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9])${escaped}(?:$|[^a-zA-Z0-9])`, 'i');
    return regex.test(text);
  }
  return text.toLowerCase().includes(cleanKeyword);
}

// Non-job system/marketing senders to exclude
const NON_JOB_SENDERS = [
  'insideapple.apple.com',
  'spotify.com',
  'youtube.com',
  'netflix.com',
  'disney',
  'tokopedia.com',
  'shopee.co.id',
  'bukalapak.com',
  'grab.com',
  'gojek.com',
  'bca.co.id',
  'mandiri.co.id',
  'bni.co.id',
  'bri.co.id',
];

// Keywords to detect job-related emails accurately
const JOB_KEYWORDS = [
  'lamaran',
  'lowongan',
  'job offer',
  'job application',
  'interview',
  'wawancara',
  'rekrutmen',
  'recruitment',
  'hiring',
  'shortlisted',
  'job vacancy',
  'karir',
  'career',
  'hrd',
  'human resource',
  'talent acquisition',
  'headhunter',
  'offering letter',
  'gaji',
  'salary',
  'psikotes',
  'user interview',
  'technical test',
  'coding test',
  'take home test',
  'screening test',
  'undangan interview',
  'undangan wawancara',
  'selamat anda lolos',
  'diterima bekerja',
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
export class GmailService implements OnModuleInit {
  private readonly logger = new Logger(GmailService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimePublisher,
  ) {}

  onModuleInit() {
    this.logger.log('Initializing automatic background Gmail sync timer (every 2 mins)');
    setInterval(() => {
      this.syncAllUsersInBackground().catch((err) => {
        this.logger.error(`Error in automatic background Gmail sync: ${err.message}`);
      });
    }, 2 * 60 * 1000);
  }

  async syncAllUsersInBackground(): Promise<void> {
    try {
      const tokens = await this.prisma.gmailToken.findMany({
        select: { userId: true },
      });
      for (const t of tokens) {
        try {
          await this.syncEmails(t.userId);
        } catch (err: any) {
          this.logger.error(`Background sync failed for user ${t.userId}: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Failed to fetch connected Gmail users for auto-sync: ${err.message}`);
    }
  }

  createOAuth2Client(): any {
    const redirectUri =
      this.config.get<string>('GOOGLE_REDIRECT_URI') ||
      'https://job.eeja.fun/api/v1/gmail/callback';

    return new google.auth.OAuth2(
      this.config.get<string>('GOOGLE_CLIENT_ID'),
      this.config.get<string>('GOOGLE_CLIENT_SECRET'),
      redirectUri,
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

    // Fetch last 200 messages in INBOX
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['INBOX'],
      maxResults: 200,
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

        // Detect if job-related using strict word-boundary matching and non-job sender exclusion
        const searchText = `${subject} ${snippet} ${fromEmail}`.toLowerCase();
        const isNonJobSender = NON_JOB_SENDERS.some((s) => fromEmail.toLowerCase().includes(s));
        const isJobRelated = !isNonJobSender && JOB_KEYWORDS.some((k) => isKeywordMatched(searchText, k));

        // Detect email type
        let detectedType: string | null = null;
        if (isJobRelated) {
          for (const [type, keywords] of Object.entries(EMAIL_TYPE_KEYWORDS)) {
            if (keywords.some((k) => isKeywordMatched(searchText, k))) {
              detectedType = type;
              break;
            }
          }
        }

        const labelIds = detail.data.labelIds || [];
        const isUnreadInGmail = labelIds.includes('UNREAD');

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

        // Create notification ONLY if job-related AND message is UNREAD in Gmail
        if (isJobRelated && isUnreadInGmail) {
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

          // Auto-update application status if email matches an application
          if (detectedType) {
            await this.autoUpdateApplicationStatus(
              userId,
              detectedType,
              subject,
              fromEmail,
              fromName,
              snippet,
            ).catch((err) => {
              this.logger.warn(`Auto status update failed for user ${userId}: ${err.message}`);
            });
          }
        }
      } catch (err: any) {
        this.logger.warn(`Failed to process message ${msg.id}: ${err.message}`);
      }
    }

    // Re-evaluate existing stored messages to fix false-positive job-related flags
    const existingMessages = await this.prisma.emailMessage.findMany({
      where: { userId },
    });

    for (const msg of existingMessages) {
      const searchText = `${msg.subject || ''} ${msg.snippet || ''} ${msg.fromEmail || ''}`.toLowerCase();
      const isNonJobSender = NON_JOB_SENDERS.some((s) => (msg.fromEmail || '').toLowerCase().includes(s));
      const correctJobRelated = !isNonJobSender && JOB_KEYWORDS.some((k) => isKeywordMatched(searchText, k));
      let correctDetectedType: string | null = null;
      if (correctJobRelated) {
        for (const [type, keywords] of Object.entries(EMAIL_TYPE_KEYWORDS)) {
          if (keywords.some((k) => isKeywordMatched(searchText, k))) {
            correctDetectedType = type;
            break;
          }
        }
      }
      if (msg.isJobRelated !== correctJobRelated || msg.detectedType !== correctDetectedType) {
        await this.prisma.emailMessage.update({
          where: { id: msg.id },
          data: { isJobRelated: correctJobRelated, detectedType: correctDetectedType },
        });
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

  private async autoUpdateApplicationStatus(
    userId: string,
    detectedType: string,
    subject: string,
    fromEmail: string,
    fromName: string | null,
    snippet: string,
  ): Promise<void> {
    const statusMap: Record<string, string> = {
      REJECTED: 'REJECTED',
      OFFER: 'OFFER',
      INTERVIEW: 'INTERVIEWING',
      SCREENING: 'SCREENING',
    };

    const targetStatus = statusMap[detectedType];
    if (!targetStatus) return;

    // Fetch user's non-terminal applications
    const apps = await this.prisma.application.findMany({
      where: {
        userId,
        status: { notIn: ['WITHDRAWN'] },
      },
      include: { company: true },
    });

    const fullSearch = `${subject} ${fromName || ''} ${fromEmail} ${snippet}`.toLowerCase();

    for (const app of apps) {
      const companyName = app.company?.name?.toLowerCase().trim();
      const jobTitle = app.jobTitle.toLowerCase().trim();

      let matched = false;
      if (companyName && companyName.length > 2 && fullSearch.includes(companyName)) {
        matched = true;
      } else if (jobTitle && jobTitle.length > 3 && fullSearch.includes(jobTitle)) {
        matched = true;
      }

      if (matched) {
        // Update application status automatically in database
        const updated = await this.prisma.application.update({
          where: { id: app.id },
          data: { status: targetStatus as any },
        });

        this.logger.log(
          `Auto-updated application ${app.id} (${app.jobTitle} at ${app.company?.name}) to status ${targetStatus} via Gmail sync`,
        );

        // Emit real-time WebSocket event to update frontend instantly
        this.realtime.emitToRoom(`user:${userId}`, 'application:updated', {
          application: updated,
        });

        break; // Stop after matching first relevant application
      }
    }
  }

  async getEmailMessages(userId: string, jobRelatedOnly = false, limit = 200) {
    const messages = await this.prisma.emailMessage.findMany({
      where: {
        userId,
        ...(jobRelatedOnly ? { isJobRelated: true } : {}),
      },
      orderBy: { receivedAt: 'desc' },
      take: limit,
    });

    const userApps = await this.prisma.application.findMany({
      where: { userId },
      include: { company: true },
    });

    return messages.map((msg) => {
      const fullSearch = `${msg.subject || ''} ${msg.fromName || ''} ${msg.fromEmail || ''} ${msg.snippet || ''}`.toLowerCase();

      let matchedApp: { id: string; jobTitle: string; companyName: string } | null = null;
      for (const app of userApps) {
        const companyName = app.company?.name?.toLowerCase().trim();
        const jobTitle = app.jobTitle?.toLowerCase().trim();

        let isMatch = false;
        if (companyName && companyName.length > 2 && fullSearch.includes(companyName)) {
          isMatch = true;
        } else if (jobTitle && jobTitle.length > 3 && fullSearch.includes(jobTitle)) {
          isMatch = true;
        }

        if (isMatch) {
          matchedApp = {
            id: app.id,
            jobTitle: app.jobTitle,
            companyName: app.company?.name || 'Perusahaan',
          };
          break;
        }
      }

      const isHrReply =
        matchedApp !== null ||
        Boolean(
          msg.detectedType &&
            ['INTERVIEW', 'OFFER', 'REJECTED', 'SCREENING', 'APPLIED_CONFIRM'].includes(
              msg.detectedType,
            ),
        );

      return {
        ...msg,
        isHrReply,
        matchedApp,
      };
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
