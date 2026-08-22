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

// Helper function to extract email body (text/plain or cleaned html) from Gmail API payload
function extractBodyFromPayload(payload: any): string {
  if (!payload) return '';

  function decodeBase64(data: string): string {
    try {
      const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
      return Buffer.from(base64, 'base64').toString('utf-8');
    } catch {
      return '';
    }
  }

  let plainText = '';
  let htmlText = '';

  function walkParts(parts: any[]) {
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        plainText += decodeBase64(part.body.data) + '\n';
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        htmlText += decodeBase64(part.body.data) + '\n';
      } else if (part.parts && Array.isArray(part.parts)) {
        walkParts(part.parts);
      }
    }
  }

  if (payload.body?.data) {
    const text = decodeBase64(payload.body.data);
    if (payload.mimeType === 'text/html') {
      htmlText = text;
    } else {
      plainText = text;
    }
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    walkParts(payload.parts);
  }

  if (plainText.trim()) {
    return plainText.trim();
  }

  if (htmlText.trim()) {
    return htmlText
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return '';
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
  'invitations@linkedin.com',
  'messages-noreply@linkedin.com',
  'updates-noreply@linkedin.com',
  'em.linkedin.com',
  'coursera.org',
  'udemy.com',
  'duolingo.com',
  'dicoding.com',
  'skillshare.com',
  'edx.org',
  'adobe.com',
  'openai.com',
  'chatgpt.com',
  'anthropic.com',
  'claude.ai',
  'canva.com',
  'figma.com',
  'notion.so',
  'grammarly.com',
  'github.com',
  'gitlab.com',
  'docker.com',
  'atlassian.com',
  'trello.com',
  'slack.com',
  'vercel.com',
  'netlify.com',
  'render.com',
  'railway.app',
  'cloudflare.com',
  'digitalocean.com',
  'googleplay',
  'payments-noreply@google.com',
  'quora.com',
  'upwork.com',
  'stockbit.com',
  'hoyoverse.com',
  'e-mail.hoyoverse.com',
  'medium.com',
  'substack.com',
  'pinterest.com',
  'reddit.com',
  'redditmail.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'facebookmail.com',
  'steampowered.com',
  'epicgames.com',
  'playstation.com',
  // AI/Dev tool providers — NOT job recruiters
  'groq.com',
  'groq.co',
  'email.groq.com',
  'developer@groq.com',
  'developer@groq.co',
  'mistral.ai',
  'huggingface.co',
  'cohere.com',
  'together.ai',
  'replicate.com',
  'perplexity.ai',
  'elevenlabs.io',
  'stability.ai',
];

// Mass job alert / portal recommendation senders to categorize under INFO_LOKER (NOT Balasan HR)
const JOB_ALERT_SENDERS = [
  'jobs-noreply@linkedin.com',
  'jobalerts-noreply@linkedin.com',
  'noreply@e.jobstreet.com',
  'noreply@jobstreet.com',
  'email.jobstreet.com',
  'e.jobstreet.com',
  'jobs2web.com',
  'jobnotification',
  'newsletter@glints.com',
  'no-reply@glints.com',
  'job-alert',
  'jobalert',
  'karir-otp@kawanlamagroup.com',
  'notification.dealls.com',
  'dealls.com',
  'glints.com',
  'kalibrr.com',
  'kitalulus.com',
];

// Mass job alert / notification subject keywords
const JOB_ALERT_SUBJECT_KEYWORDS = [
  'pekerjaan baru yang serupa',
  'lihat kecocokan pekerjaan',
  'pemberitahuan pekerjaan',
  'peringatan pekerjaan',
  'rekomendasi lowongan',
  'rekomendasi pekerjaan',
  'lowongan kerja baru',
  'new jobs posted',
  'your job alert',
  'job alert matched',
  'matched the following jobs',
  'konfirmasi email anda',
  'exclusive job offers',
  'get exclusive job offers',
  'verify your deall account',
  'verify your account',
  'verify your email',
];

// Specific phrases indicating an actual job application submitted by the user (overrides mass alert senders)
const APPLIED_CONFIRM_KEYWORDS = [
  'lamaranmu berhasil dikirim',
  'lamaran anda sudah dikirim',
  'lamaran anda telah dikirim',
  'lamaran berhasil dikirim',
  'lamaran anda dikirim',
  'sudah dikirim ke',
  'berhasil dikirimkan ke',
  'application received',
  'application for',
  'application submitted',
  'application was sent',
  'your application has been submitted',
  'your application was sent',
  'your application to',
  'viewed your application',
  'has recently viewed your application',
  'thank you for applying',
  'thanks for applying',
  'terima kasih telah melamar',
  'terima kasih sudah melamar',
  'terima kasih atas lamaran',
  'konfirmasi lamaran',
  'aplikasi anda telah kami terima',
  'lamaran anda sudah kami terima',
  'lamaran anda telah kami terima',
  'lamaran anda sudah diterima',
  'sudah kami terima dan akan',
  'sudah melamar ke lowongan',
  'sudah melamar sebagai',
  'telah melamar ke lowongan',
  'lamaran kamu',
  'your application is being reviewed',
  'we received your application',
  'we have received your application',
];

// System Auth, account creation, activation & OTP keywords to be excluded from HR replies
const SYSTEM_AUTH_KEYWORDS = [
  'otp',
  'kode otp',
  'konfirmasi email',
  'confirm email',
  'verifikasi email',
  'email verification',
  'reset kata sandi',
  'reset password',
  'kode verifikasi',
  'verification code',
  'security code',
  'login attempt',
  'activate your account',
  'activate account',
  'aktifkan akun',
  'verifikasi akun',
  'activate my account',
  'account activation',
  'thank you for register',
  'register to',
  'mendaftar di',
];

// Keywords to detect job-related emails accurately (Indonesian & English)
const JOB_KEYWORDS = [
  // Standalone Core Recruitment Terms
  'screening',
  'interview',
  'assessment',
  'shortlisted',
  'recruitment',
  'rekrutmen',
  'applicant',
  'candidate',
  'lamaran',
  'lowongan',
  'wawancara',
  'psikotes',
  'loker',
  'karir',

  // Indonesian Keywords
  'panggilan tes',
  'tahap seleksi',
  'proses seleksi',
  'undangan interview',
  'undangan wawancara',
  'undangan psikotes',
  'undangan tes',
  'surat penawaran',
  'penawaran kerja',
  'selamat anda lolos',
  'diterima bekerja',
  'penolakan lamaran',
  'mohon maaf',
  'belum dapat melanjutkan',
  'belum memenuhi kualifikasi',
  'tim hrd',
  'tim rekruter',
  'tim talent',
  'tes potensi akademik',
  'pekerjaan',
  'pemberitahuan pekerjaan',
  'peringatan pekerjaan',
  'rekomendasi pekerjaan',
  'pencarian kerja',
  'seleksi berkas',
  'seleksi administrasi',
  'tes online',
  'tes teknikal',

  // English Keywords
  'job application',
  'application for',
  'application received',
  'thank you for applying',
  'thanks for applying',
  'job offer',
  'offer letter',
  'interview invitation',
  'invitation to interview',
  'invitation for interview',
  'invitation from',
  'schedule an interview',
  'interview schedule',
  'talent acquisition',
  'human resources',
  'hiring team',
  'hiring manager',
  'hr team',
  'job vacancy',
  'career opportunity',
  'technical assessment',
  'coding assessment',
  'online assessment',
  'take home test',
  'screening call',
  'screening interview',
  'phone screening',
  'user interview',
  'ta interview',
  'it screening',
  'screening test',
  'regret to inform',
  'unsuccessful application',
  'we decided to move forward with another',
  'position has been filled',
  'company review',
  'job description',
  'task and responsibility',
  'on cam',
  'meet date',
  'meet time',
  'meeting id',
  'teams.microsoft.com',
  'meet.google.com',
  'zoom.us',
  'jobalert',
  'jobalerts',
  'job alert',
  'job notification',
  'jobnotification',

  // Platforms & ATS system signatures
  'greenhouse.io',
  'workday.com',
  'lever.co',
  'smartrecruiters',
  'jobstreet',
  'glints',
  'kalibrr',
  'dealls',
  'kitalulus',
  'linkedin jobs',
];

const EMAIL_TYPE_KEYWORDS: Record<string, string[]> = {
  INTERVIEW: [
    'interview invitation',
    'invitation for interview',
    'invitation to interview',
    'invitation for an interview',
    'schedule an interview',
    'schedule your interview',
    'interview schedule',
    'interview session',
    'panggilan wawancara',
    'undangan wawancara',
    'undangan interview',
    'panggilan interview',
    'user interview',
    'hr interview',
    'tech interview',
    'technical interview',
    'ta interview',
    'final interview',
    'online interview',
    'interview with',
    'interview for',
    'interview details',
    'interview link',
    'teams.microsoft.com',
    'meet.google.com',
    'zoom.us',
  ],
  OFFER: [
    'job offer',
    'penawaran kerja',
    'offer letter',
    'salary offer',
    'surat penawaran',
    'congratulations on your offer',
    'pleased to offer',
    'bergabung bersama kami',
    'offered the position',
    'job offer letter',
  ],
  REJECTED: [
    'rejected',
    'ditolak',
    'tidak lolos',
    'not selected',
    'unfortunately',
    'tidak memenuhi',
    'kami menyesal',
    'regret to inform',
    'unsuccessful',
    'decided not to proceed',
    'pursuing other candidates',
    'tidak meneruskan proses lamaran',
    'tidak akan meneruskan proses lamaran',
    'tidak melanjutkan proses lamaran',
    'belum dapat dilanjutkan',
    'belum dapat kami lanjutkan',
    'belum dapat diproses',
    'belum sesuai',
    'belum memenuhi kualifikasi',
    'belum bisa melanjutkan',
    'tidak sesuai dengan profil',
    'tidak sesuai dengan kebutuhan',
    'profil anda masih belum',
    'profil anda belum',
    'posisi yang anda lamar',
    'we will not be moving forward',
    'we have decided not to proceed',
    'will not be proceeding',
    'not moving forward',
    'other candidates',
    'another candidate',
    'high volume of applicants',
    'not selected for',
  ],
  SCREENING: [
    'hr screening',
    'initial screening',
    'screening call',
    'screening interview',
    'phone screening',
    'it screening',
    'shortlisted',
    'lolos seleksi',
    'test online',
    'tes online',
    'assessment',
    'psikotes',
    'coding test',
    'technical test',
    'take home test',
    'tahap berikutnya',
    'next step',
    'proses seleksi',
    'tahap seleksi',
    'company review',
  ],
  APPLIED_CONFIRM: [
    'application received',
    'application for',
    'lamaran diterima',
    'thank you for applying',
    'thanks for applying',
    'terima kasih telah melamar',
    'terima kasih sudah melamar',
    'terima kasih atas lamaran',
    'konfirmasi lamaran',
    'aplikasi anda telah kami terima',
    'lamaran anda sudah kami terima',
    'lamaran anda telah kami terima',
    'lamaran anda sudah diterima',
    'sudah kami terima dan akan',
    'sudah melamar ke lowongan',
    'sudah melamar sebagai',
    'telah melamar ke lowongan',
    'lamaran kamu',
    'lamaranmu berhasil dikirim',
    'lamaran anda sudah dikirim',
    'lamaran anda telah dikirim',
    'lamaran berhasil dikirim',
    'lamaran anda dikirim',
    'lamaran anda untuk',
    'sudah dikirim ke',
    'berhasil dikirimkan ke',
    'application submitted',
    'application was sent',
    'your application has been submitted',
    'your application was sent',
    'we received your application',
    'we have received your application',
    'your application is being reviewed',
  ],
};

import { WhatsappService } from '../whatsapp/whatsapp.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class GmailService implements OnModuleInit {
  private readonly logger = new Logger(GmailService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimePublisher,
    private readonly whatsapp: WhatsappService,
    private readonly telegram: TelegramService,
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
        where: { isActive: true },
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

    let listRes;
    try {
      // Fetch last 200 messages in INBOX
      listRes = await gmail.users.messages.list({
        userId: 'me',
        labelIds: ['INBOX'],
        maxResults: 200,
      });
    } catch (err: any) {
      const errMsg = err.message || '';
      if (
        errMsg.includes('invalid_grant') ||
        errMsg.includes('invalid_request') ||
        errMsg.includes('Token has been expired or revoked') ||
        err.code === 401 ||
        err.status === 401
      ) {
        this.logger.warn(`Gmail OAuth token expired or revoked for userId=${userId}. Deactivating token: ${errMsg}`);
        await this.prisma.gmailToken.update({
          where: { userId },
          data: { isActive: false },
        });
        throw new Error('Koneksi Gmail Anda telah kadaluarsa atau dibatalkan. Silakan hubungkan kembali akun Gmail Anda.');
      }
      throw err;
    }

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
          format: 'full',
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
        const bodyText = extractBodyFromPayload(detail.data.payload);

        // Parse from email/name
        const fromMatch = fromRaw.match(/^(?:"?(.+?)"?\s)?<?([^>]+)>?$/);
        const fromName = fromMatch?.[1]?.trim() || null;
        const fromEmail = fromMatch?.[2]?.trim() || fromRaw;

        const receivedAt = dateStr ? new Date(dateStr) : new Date();

        const searchText = `${subject} ${snippet} ${bodyText} ${fromEmail}`.toLowerCase();

        const isSystemAuth =
          SYSTEM_AUTH_KEYWORDS.some((k) => isKeywordMatched(searchText, k)) ||
          fromEmail.toLowerCase().includes('otp');

        const isNonJobSender = NON_JOB_SENDERS.some((s) => fromEmail.toLowerCase().includes(s));
        let isJobRelated = !isNonJobSender && !isSystemAuth && JOB_KEYWORDS.some((k) => isKeywordMatched(searchText, k));

        // Smart fallback: If subject starts with "RE:" or "Fwd:" and contains "application", "lamaran", "staff", etc.
        const lowerSub = subject.toLowerCase();
        if (!isJobRelated && !isNonJobSender) {
          if (
            (lowerSub.startsWith('re:') || lowerSub.startsWith('fwd:')) &&
            (lowerSub.includes('application') || lowerSub.includes('lamaran') || lowerSub.includes('candidate') || lowerSub.includes('applicant'))
          ) {
            isJobRelated = true;
          }
        }

        const isAppConfirmation = APPLIED_CONFIRM_KEYWORDS.some((k) => searchText.includes(k));

        let detectedType: string | null = null;
        for (const [type, keywords] of Object.entries(EMAIL_TYPE_KEYWORDS)) {
          if (keywords.some((k) => isKeywordMatched(searchText, k))) {
            detectedType = type;
            break;
          }
        }
        if (!detectedType && (isAppConfirmation || lowerSub.startsWith('re:') || lowerSub.startsWith('fwd:'))) {
          detectedType = 'APPLIED_CONFIRM';
        }

        const isJobAlertOrNewsletter =
          !isAppConfirmation &&
          (JOB_ALERT_SENDERS.some((s) => fromEmail.toLowerCase().includes(s)) ||
            JOB_ALERT_SUBJECT_KEYWORDS.some((k) => lowerSub.includes(k)) ||
            isSystemAuth ||
            isNonJobSender);

        if (isJobAlertOrNewsletter) {
          detectedType = null;
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
            bodyText,
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

          // Push instant notification to WhatsApp Bot
          this.whatsapp.notifyEmailNotification(userId, notifTitle, notifBody).catch((err) => {
            this.logger.warn(`Failed to send WhatsApp notification to user ${userId}: ${err.message}`);
          });

          // Push instant notification to Telegram Bot
          this.telegram.notifyEmailNotification(userId, notifTitle, notifBody).catch((err) => {
            this.logger.warn(`Failed to send Telegram notification to user ${userId}: ${err.message}`);
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
              bodyText,
            ).catch((err) => {
              this.logger.warn(`Auto status update failed for user ${userId}: ${err.message}`);
            });
          }
        }
      } catch (err: any) {
        this.logger.warn(`Failed to process message ${msg.id}: ${err.message}`);
      }
    }

    // Re-evaluate existing stored messages to fix false-positive / false-negative flags and populate missing bodyText
    const existingMessages = await this.prisma.emailMessage.findMany({
      where: { userId },
    });

    for (const msg of existingMessages) {
      let bodyText = msg.bodyText || '';

      // If bodyText is missing, fetch full email detail from Gmail API
      if (!bodyText && msg.gmailMessageId) {
        try {
          const detail = await gmail.users.messages.get({
            userId: 'me',
            id: msg.gmailMessageId,
            format: 'full',
          });
          bodyText = extractBodyFromPayload(detail.data.payload);
        } catch (err: any) {
          // Ignore if message fails to fetch
        }
      }

      const fromEmail = (msg.fromEmail || '').toLowerCase();
      const subject = (msg.subject || '').toLowerCase();
      const searchText = `${subject} ${msg.snippet || ''} ${bodyText} ${fromEmail}`.toLowerCase();

      const isNonJobSender = NON_JOB_SENDERS.some((s) => fromEmail.includes(s));
      const isAppConfirmation = APPLIED_CONFIRM_KEYWORDS.some((k) => searchText.includes(k));
      const isSystemAuth =
        SYSTEM_AUTH_KEYWORDS.some((k) => isKeywordMatched(searchText, k)) ||
        fromEmail.includes('otp');

      let correctDetectedType: string | null = null;
      for (const [type, keywords] of Object.entries(EMAIL_TYPE_KEYWORDS)) {
        if (keywords.some((k) => isKeywordMatched(searchText, k))) {
          correctDetectedType = type;
          break;
        }
      }
      if (!correctDetectedType && isAppConfirmation) {
        correctDetectedType = 'APPLIED_CONFIRM';
      }

      const isJobAlertOrNewsletter =
        !isAppConfirmation &&
        !correctDetectedType &&
        (isSystemAuth ||
          isNonJobSender ||
          JOB_ALERT_SENDERS.some((s) => fromEmail.includes(s)) ||
          JOB_ALERT_SUBJECT_KEYWORDS.some((k) => subject.includes(k)));

      if (isJobAlertOrNewsletter || isNonJobSender || isSystemAuth) {
        correctDetectedType = null;
      }

      const correctJobRelated = !isNonJobSender && !isSystemAuth && (JOB_KEYWORDS.some((k) => isKeywordMatched(searchText, k)) || !!correctDetectedType);

      if (
        msg.isJobRelated !== correctJobRelated ||
        msg.detectedType !== correctDetectedType ||
        (bodyText && !msg.bodyText)
      ) {
        await this.prisma.emailMessage.update({
          where: { id: msg.id },
          data: {
            isJobRelated: correctJobRelated,
            detectedType: correctDetectedType,
            ...(bodyText ? { bodyText } : {}),
          },
        });

        // Trigger auto application status update if a type (e.g. REJECTED) is detected
        if (correctDetectedType) {
          await this.autoUpdateApplicationStatus(
            userId,
            correctDetectedType,
            msg.subject,
            msg.fromEmail,
            msg.fromName,
            msg.snippet,
            bodyText,
          ).catch((err) => {
            this.logger.warn(`Auto status update during re-eval failed for user ${userId}: ${err.message}`);
          });
        }
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
    bodyText?: string,
  ): Promise<void> {
    const statusMap: Record<string, string> = {
      REJECTED: 'REJECTED',
      OFFER: 'OFFER',
      INTERVIEW: 'HR_INTERVIEW',
      SCREENING: 'ASSESSMENT',
      APPLIED_CONFIRM: 'APPLIED',
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

    const fullSearch = `${subject} ${fromName || ''} ${fromEmail} ${snippet} ${bodyText || ''}`.toLowerCase();

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
      const fromEmailLower = (msg.fromEmail || '').toLowerCase();
      const subjectLower = (msg.subject || '').toLowerCase();
      const snippetLower = (msg.snippet || '').toLowerCase();
      const fullSearch = `${subjectLower} ${msg.fromName?.toLowerCase() || ''} ${fromEmailLower} ${snippetLower}`;

      const isNonJobSender = NON_JOB_SENDERS.some((s) => fromEmailLower.includes(s));
      const isAppConfirmation = APPLIED_CONFIRM_KEYWORDS.some((k) => fullSearch.includes(k));
      const isSystemAuth = SYSTEM_AUTH_KEYWORDS.some((k) => isKeywordMatched(fullSearch, k)) || fromEmailLower.includes('otp');

      const isJobAlertOrNewsletter =
        !isAppConfirmation &&
        (isSystemAuth ||
          isNonJobSender ||
          JOB_ALERT_SENDERS.some((s) => fromEmailLower.includes(s)) ||
          JOB_ALERT_SUBJECT_KEYWORDS.some((k) => subjectLower.includes(k)));

      let matchedApp: { id: string; jobTitle: string; companyName: string } | null = null;

      // Mass job alerts, recommendations, and non-job senders are NOT HR replies to individual applications
      if (!isJobAlertOrNewsletter && !isNonJobSender && msg.isJobRelated) {
        for (const app of userApps) {
          const companyName = app.company?.name?.toLowerCase().trim();
          const jobTitle = app.jobTitle?.toLowerCase().trim();

          let isMatch = false;
          if (companyName && companyName.length > 2 && fullSearch.includes(companyName)) {
            isMatch = true;
          } else if (
            jobTitle &&
            jobTitle.length > 3 &&
            (subjectLower.includes(jobTitle) || snippetLower.includes(jobTitle)) &&
            (subjectLower.startsWith('re:') || subjectLower.startsWith('fwd:') || subjectLower.includes('application') || subjectLower.includes('lamaran'))
          ) {
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
      }

      // isHrReply: strict — must have a matched application OR an explicitly confirmed type
      // Loose subject keywords alone (screening/interview/test) are NOT enough — they produce false positives
      // from AI tools, developer newsletters, etc.
      const hasConfirmedType = Boolean(
        msg.detectedType &&
          ['INTERVIEW', 'OFFER', 'REJECTED', 'SCREENING', 'APPLIED_CONFIRM'].includes(
            msg.detectedType,
          ),
      );

      const hasTrustedSenderSignal =
        fromEmailLower.includes('recruitment') ||
        fromEmailLower.includes('talent') ||
        fromEmailLower.includes('careers') ||
        fromEmailLower.includes('hr@') ||
        fromEmailLower.includes('hrd@') ||
        fromEmailLower.includes('@hrd.') ||
        fromEmailLower.includes('rekrutmen') ||
        fromEmailLower.includes('talentics') ||
        fromEmailLower.includes('kalibrr') ||
        fromEmailLower.includes('dealls');

      const isHrReply =
        !isJobAlertOrNewsletter &&
        !isNonJobSender &&
        !isSystemAuth &&
        Boolean(msg.isJobRelated) &&
        // Must have at least ONE strong signal:
        (matchedApp !== null || hasConfirmedType || hasTrustedSenderSignal);

      return {
        ...msg,
        isHrReply,
        matchedApp,
      };
    });
  }

  async removeEmailMessage(userId: string, emailId: string): Promise<void> {
    await this.prisma.emailMessage.deleteMany({
      where: { id: emailId, userId },
    });
  }

  async getNotifications(userId: string, limit = 50, unreadOnly = true) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
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
