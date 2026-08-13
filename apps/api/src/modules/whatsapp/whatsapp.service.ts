import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApplicationStatus } from '@prisma/client';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly gatewayUrl: string;
  private readonly apiKey: string;

  constructor(private readonly prisma: PrismaService) {
    this.gatewayUrl = process.env.WA_GATEWAY_URL || 'http://gateway-whatsapp-bot:3001';
    this.apiKey = process.env.WA_GATEWAY_API_KEY || 'eeja_wa_gateway_secret_key_2026';
  }

  private normalizePhone(phone: string): string {
    if (!phone) return '';
    const cleaned = phone.split('@')[0].replace(/\D/g, '');
    if (!cleaned) return '';
    if (cleaned.startsWith('0')) return `62${cleaned.slice(1)}`;
    return cleaned;
  }

  private parsePhoneList(raw?: string | null): string[] {
    if (!raw) return [];
    return Array.from(
      new Set(
        raw
          .split(',')
          .map((item) => this.normalizePhone(item))
          .filter(Boolean),
      ),
    );
  }

  async sendTextMessage(to: string, message: string): Promise<boolean> {
    try {
      const normalizedTo = this.normalizePhone(to);
      const response = await fetch(`${this.gatewayUrl}/api/v1/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.apiKey,
        },
        body: JSON.stringify({ to: normalizedTo || to, message }),
      });
      const data = (await response.json()) as { success?: boolean };
      return data.success === true;
    } catch (err: any) {
      this.logger.error(`Failed to send WhatsApp message to ${to}: ${err.message}`);
      return false;
    }
  }

  async getStatus(): Promise<{ status: string; connectedUser: string | null; hasQr: boolean; qrDataUrl?: string }> {
    try {
      const response = await fetch(`${this.gatewayUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      const data = (await response.json()) as any;
      return {
        status: data.status || 'disconnected',
        connectedUser: data.connectedUser || null,
        hasQr: !!data.hasQr,
        qrDataUrl: data.qrDataUrl || undefined,
      };
    } catch (err: any) {
      return { status: 'disconnected', connectedUser: null, hasQr: false };
    }
  }

  async logoutSession(): Promise<boolean> {
    try {
      const response = await fetch(`${this.gatewayUrl}/api/v1/messages/logout`, {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
        },
      });
      const data = (await response.json()) as any;
      return data.success === true;
    } catch (err: any) {
      return false;
    }
  }

  private async getNotificationPhones(userId: string): Promise<string[]> {
    const configuredPhones = this.parsePhoneList(
      process.env.WA_NOTIFICATION_PHONES || process.env.WA_NOTIFICATION_PHONE,
    );
    if (configuredPhones.length > 0) {
      return configuredPhones;
    }

    // Default to user's personal number for HR email notifications
    return ['6281288092766'];
  }

  async notifyEmailNotification(userId: string, title: string, body: string): Promise<void> {
    const phones = await this.getNotificationPhones(userId);
    if (phones.length === 0) {
      this.logger.warn(`Cannot send WA email notification: No phone number or connected user found.`);
      return;
    }

    const messageText = `🔔 *NOTIFIKASI BALASAN HRD BARU*\n\n📩 *${title}*\n${body}\n\n🔗 _Buka Dashboard Gmail:_ https://job.eeja.fun/dashboard/gmail`;
    this.logger.log(`Sending instant WA email notification to ${phones.join(', ')}`);
    await Promise.allSettled(phones.map((phone) => this.sendTextMessage(phone, messageText)));
  }

  async handleIncomingWebhook(payload: { from: string; body: string; pushName?: string }): Promise<void> {
    const { from, body, pushName } = payload;
    const text = (body || '').trim();
    if (!text || !from) return;

    // Must start with ! or /
    if (!text.startsWith('!') && !text.startsWith('/')) return;

    const normalizedFrom = this.normalizePhone(from);
    const adminPhones = this.parsePhoneList(
      process.env.WA_NOTIFICATION_PHONES || process.env.WA_NOTIFICATION_PHONE || '6281288092766',
    );
    const isAdmin = adminPhones.includes(normalizedFrom);
    if (!isAdmin) {
      this.logger.warn(`Ignoring Job Tracker WA command from non-admin user: ${from} (normalized: ${normalizedFrom})`);
      return;
    }

    const lower = text.toLowerCase();
    // Ignore finance commands explicitly
    if (lower.startsWith('!cicilan') || lower.startsWith('/cicilan') || lower.startsWith('!hariini') || lower.startsWith('/hariini') || lower.startsWith('!saldo') || lower.startsWith('/saldo') || lower.startsWith('!pengeluaran') || lower.startsWith('/pengeluaran') || lower.startsWith('!fin') || lower.startsWith('/fin')) {
      return;
    }

    this.logger.log(`Processing WA Job Tracker Command from ${from} (${pushName}): ${text}`);
    let reply = '';

    if (lower.startsWith('!loker') || lower.startsWith('/loker')) {
      reply = await this.getApplicationsMessage();
    } else if (lower.startsWith('!email') || lower.startsWith('/email')) {
      reply = await this.getHrRepliesMessage();
    } else if (lower.startsWith('!job') || lower.startsWith('/job')) {
      reply = await this.getOverviewMessage();
    } else if (lower.startsWith('!tambah') || lower.startsWith('/tambah')) {
      if (text.includes('|') && !/\d+/.test(text.split('|')[0])) {
        reply = await this.createApplicationFromWa(text);
      }
    }
    // Unknown commands: silently ignore (no reply) to avoid spam

    if (reply) {
      await this.sendTextMessage(from, reply);
    }
  }

  private getHelpMessage(pushName?: string): string {
    return `🤖 *JOB TRACKER BOT MENU*
Halo ${pushName || 'User'}! Berikut adalah daftar perintah yang bisa kamu gunakan:

📊 *!overview* / *!dashboard*
Cek ringkasan total lamaran, status, & stage penolakan.

💼 *!lamaran* / *!loker*
Lihat 5 lamaran kerja terbaru yang kamu daftarkan.

📩 *!email* / *!balasan*
Cek 5 balasan email dari HRD/perusahaan terbaru.

➕ *!tambah [Judul Pekerjaan] | [Nama Perusahaan] | [Status (Opsional)]*
Tambah lamaran baru via WA!
_Contoh:_ \`!tambah Backend Developer | Tokopedia | APPLIED\`
_Atau:_ \`!tambah Frontend Engineer | Gojek | INTERVIEWING\`

💡 _Ketik salah satu perintah di atas untuk mulai._`;
  }

  private async getPrimaryUserId(): Promise<string> {
    const topUser = await this.prisma.application.groupBy({
      by: ['userId'],
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 1,
    });
    if (topUser.length > 0) return topUser[0].userId;

    const gmailToken = await this.prisma.gmailToken.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (gmailToken?.userId) return gmailToken.userId;

    const user = await this.prisma.user.findFirst();
    return user?.id || '';
  }

  private async getOverviewMessage(): Promise<string> {
    const userId = await this.getPrimaryUserId();
    const totalApps = await this.prisma.application.count({ where: { userId } });
    const apps = await this.prisma.application.findMany({ where: { userId } });

    const statusCounts: Record<string, number> = {
      SAVED: 0,
      APPLIED: 0,
      ASSESSMENT: 0,
      HR_INTERVIEW: 0,
      USER_INTERVIEW: 0,
      OFFER: 0,
      REJECTED: 0,
      WITHDRAWN: 0,
    };

    const rejectionCounts: Record<string, number> = {
      APPLIED: 0,
      ASSESSMENT: 0,
      HR_INTERVIEW: 0,
      USER_INTERVIEW: 0,
      OFFER: 0,
    };

    apps.forEach((app) => {
      const st = app.status;
      if (statusCounts[st] !== undefined) {
        statusCounts[st]++;
      }
      if (st === 'REJECTED') {
        let stage = app.rejectedAtStage || 'APPLIED';
        if (stage === 'CV') stage = 'APPLIED';
        if (stage === 'HR') stage = 'HR_INTERVIEW';
        if (stage === 'USER') stage = 'USER_INTERVIEW';
        if (stage === 'OFFERING') stage = 'OFFER';
        rejectionCounts[stage] = (rejectionCounts[stage] || 0) + 1;
      }
    });

    return `📊 *OVERVIEW DASHBOARD LAMARAN*

📋 *Total Lamaran*: ${totalApps}

📌 *Breakdown Status:*
• Saved: ${statusCounts.SAVED}
• Applied: ${statusCounts.APPLIED}
• Assessment / Tes: ${statusCounts.ASSESSMENT}
• HR Interview: ${statusCounts.HR_INTERVIEW}
• User Interview: ${statusCounts.USER_INTERVIEW}
• Offer: ${statusCounts.OFFER}
• Rejected: ${statusCounts.REJECTED}
• Withdrawn: ${statusCounts.WITHDRAWN}

❌ *Analisis Stage Penolakan (${statusCounts.REJECTED} Total):*
• CV Screening (Applied): ${rejectionCounts.APPLIED}
• Assessment / Tes: ${rejectionCounts.ASSESSMENT}
• HR Interview: ${rejectionCounts.HR_INTERVIEW}
• User Interview: ${rejectionCounts.USER_INTERVIEW}
• Offering: ${rejectionCounts.OFFER}

🔗 _Dashboard Web:_ https://job.eeja.fun/dashboard`;
  }

  private async getApplicationsMessage(): Promise<string> {
    const userId = await this.getPrimaryUserId();
    const apps = await this.prisma.application.findMany({
      where: { userId },
      orderBy: [
        { appliedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 5,
      include: { company: true },
    });

    if (apps.length === 0) {
      return `💼 *DAFTAR LAMARAN KERJA*\n\nBelum ada lamaran kerja yang terdaftar. Ketik *!tambah* untuk menambahkan lamaran baru!`;
    }

    let msg = `💼 *5 LAMARAN KERJA TERBARU*\n\n`;
    apps.forEach((app, idx) => {
      const dateStr = app.appliedAt
        ? new Date(app.appliedAt).toLocaleDateString('id-ID')
        : new Date(app.createdAt).toLocaleDateString('id-ID');
      msg += `${idx + 1}. *${app.jobTitle}*\n   🏢 Perusahaan: ${app.company?.name || 'N/A'}\n   📌 Status: *${app.status}*\n   📅 Apply: ${dateStr}\n\n`;
    });

    msg += `🔗 _Lihat Semua Lamaran:_ https://job.eeja.fun/dashboard/applications`;
    return msg;
  }

  private async getHrRepliesMessage(): Promise<string> {
    const userId = await this.getPrimaryUserId();

    // Priority 1: Emails with a detected HR type (INTERVIEW, OFFER, REJECTED, SCREENING, APPLIED_CONFIRM)
    let messages = await this.prisma.emailMessage.findMany({
      where: { userId, detectedType: { not: null } },
      orderBy: { receivedAt: 'desc' },
      take: 5,
    });

    // Priority 2: Any job-related email (may include job alerts, but better than nothing)
    if (messages.length === 0) {
      messages = await this.prisma.emailMessage.findMany({
        where: { userId, isJobRelated: true },
        orderBy: { receivedAt: 'desc' },
        take: 5,
      });
    }

    // Priority 3: Last resort — 5 newest emails of any kind
    if (messages.length === 0) {
      messages = await this.prisma.emailMessage.findMany({
        where: { userId },
        orderBy: { receivedAt: 'desc' },
        take: 5,
      });
    }

    if (messages.length === 0) {
      return `📩 *BALASAN EMAIL HRD*\n\nBelum ada balasan email yang terdeteksi di inbox Gmail kamu. Hubungkan akun Gmail di dashboard untuk menyinkronkan email secara otomatis!\n\n🔗 _Hubungkan Gmail:_ https://job.eeja.fun/dashboard/gmail`;
    }

    const typeLabel: Record<string, string> = {
      INTERVIEW: '🎤 Undangan Interview',
      OFFER: '🎉 Job Offer',
      REJECTED: '❌ Penolakan',
      SCREENING: '📋 Lolos Screening',
      APPLIED_CONFIRM: '✅ Konfirmasi Lamaran',
    };

    const hasHrReplies = messages.some((m) => m.detectedType);
    let msg = hasHrReplies
      ? `📩 *BALASAN HRD TERBARU*\n\n`
      : `📩 *5 EMAIL LOKER TERBARU*\n_(Belum ada balasan HRD yang terdeteksi)_\n\n`;

    messages.forEach((m, idx) => {
      const tipe = m.detectedType ? typeLabel[m.detectedType] || m.detectedType : (m.isJobRelated ? '📢 Info Loker' : '📧 Email');
      msg += `${idx + 1}. *${m.subject || 'Tanpa Subjek'}*\n   👤 Dari: ${m.fromName || m.fromEmail}\n   🏷️ Tipe: ${tipe}\n   📅 Waktu: ${new Date(m.receivedAt).toLocaleString('id-ID')}\n\n`;
    });

    msg += `🔗 _Buka Inbox Gmail:_ https://job.eeja.fun/dashboard/gmail`;
    return msg;
  }

  private async createApplicationFromWa(text: string): Promise<string> {
    // Format: !tambah Job Title | Company Name | Status (optional)
    const content = text.replace(/^!tambah/i, '').trim();
    if (!content) {
      return `⚠️ *Format Salah!*\n\n*Cara Menggunakan:* \`!tambah [Judul Pekerjaan] | [Nama Perusahaan] | [Status (Opsional)]\`\n\n*Contoh:* \`!tambah Fullstack Engineer | Tokopedia | APPLIED\``;
    }

    const parts = content.split('|').map((s) => s.trim());
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      return `⚠️ *Format Salah!*\n\nMohon sertakan Judul Pekerjaan dan Nama Perusahaan dipisahkan dengan tanda \`|\`.\n\n*Contoh:* \`!tambah Backend Engineer | Gojek\``;
    }

    const jobTitle = parts[0];
    const companyName = parts[1];
    let statusStr = parts[2] ? parts[2].toUpperCase() : 'APPLIED';

    const validStatuses = ['SAVED', 'APPLIED', 'ASSESSMENT', 'HR_INTERVIEW', 'USER_INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN'];
    if (!validStatuses.includes(statusStr)) {
      statusStr = 'APPLIED';
    }

    const status = statusStr as ApplicationStatus;

    // Assign to primary user (user with most applications)
    const userId = await this.getPrimaryUserId();
    if (!userId) {
      return `❌ *Gagal!* Tidak menemukan akun user di database.`;
    }

    // Find or create company
    let company = await this.prisma.company.findFirst({
      where: { name: { equals: companyName, mode: 'insensitive' } },
    });

    if (!company) {
      company = await this.prisma.company.create({
        data: { name: companyName },
      });
    }

    // Create application
    const app = await this.prisma.application.create({
      data: {
        userId,
        companyId: company.id,
        jobTitle,
        status,
        appliedAt: new Date(),
      },
    });

    return `✅ *BERHASIL MENAMBAHKAN LAMARAN!*

💼 *Posisi*: ${app.jobTitle}
🏢 *Perusahaan*: ${company.name}
📌 *Status*: *${app.status}*
🆔 *ID Lamaran*: \`${app.id}\`

🔗 _Lihat di Dashboard:_ https://job.eeja.fun/dashboard/applications`;
  }
}
