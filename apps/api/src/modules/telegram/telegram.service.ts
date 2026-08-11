import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApplicationStatus } from '@prisma/client';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private botToken: string;
  private chatId: string;
  private isPolling = false;
  private pollOffset = 0;

  constructor(private readonly prisma: PrismaService) {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';
  }

  onModuleInit() {
    this.initBot();
  }

  private initBot() {
    if (this.botToken) {
      this.logger.log(`Telegram Bot initialized with token (ends with ...${this.botToken.slice(-5)})`);
      this.startPolling();
    } else {
      this.logger.warn(`Telegram Bot Token is not configured. Set TELEGRAM_BOT_TOKEN in .env or via dashboard.`);
    }
  }

  public setConfig(token: string, chatId: string) {
    this.botToken = token.trim();
    this.chatId = chatId.trim();
    if (this.botToken && !this.isPolling) {
      this.startPolling();
    }
  }

  public getStatus() {
    return {
      configured: !!this.botToken,
      hasChatId: !!this.chatId,
      botTokenMasked: this.botToken ? `...${this.botToken.slice(-6)}` : null,
      chatId: this.chatId || null,
      isPolling: this.isPolling,
    };
  }

  async sendTelegramMessage(chatIdTarget: string, text: string, parseMode: 'HTML' | 'Markdown' = 'HTML'): Promise<boolean> {
    const token = this.botToken;
    const target = chatIdTarget || this.chatId;

    if (!token || !target) {
      this.logger.warn(`Cannot send Telegram message: Bot token or target chat ID is missing.`);
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: target,
          text,
          parse_mode: parseMode,
          disable_notification: false, // High priority sound & vibration
        }),
      });

      const data = (await response.json()) as any;
      if (data.ok) {
        this.logger.log(`Telegram notification sent successfully to ${target}`);
        return true;
      } else {
        this.logger.error(`Telegram API Error: ${data.description || JSON.stringify(data)}`);
        return false;
      }
    } catch (err: any) {
      this.logger.error(`Failed to send Telegram message: ${err.message}`);
      return false;
    }
  }

  async notifyEmailNotification(userId: string, title: string, body: string): Promise<void> {
    if (!this.botToken || !this.chatId) {
      return;
    }

    const htmlMessage = `<b>🔔 NOTIFIKASI BALASAN HRD BARU</b>\n\n📩 <b>${this.escapeHtml(title)}</b>\n${this.escapeHtml(body)}\n\n🔗 <a href="https://job.eeja.fun/dashboard/gmail">Buka Dashboard Gmail</a>`;
    await this.sendTelegramMessage(this.chatId, htmlMessage, 'HTML');
  }

  private startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;
    this.logger.log(`Starting background polling for Telegram Bot commands...`);
    this.pollLoop();
  }

  private async pollLoop() {
    while (this.isPolling) {
      if (!this.botToken) {
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      try {
        const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.pollOffset}&timeout=10`;
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        const data = (await res.json()) as any;

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            this.pollOffset = update.update_id + 1;
            await this.handleUpdate(update);
          }
        }
      } catch (err: any) {
        // Silently wait on network timeout
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  public async handleUpdate(update: any) {
    const msg = update.message;
    if (!msg || !msg.text) return;

    const fromChatId = String(msg.chat.id);
    const text = msg.text.trim();
    const senderName = msg.from?.first_name || 'User';

    this.logger.log(`Telegram Bot Command received from ${senderName} (${fromChatId}): ${text}`);
    const lower = text.toLowerCase();

    let replyHtml = '';

    if (lower.startsWith('/start') || lower.startsWith('/help') || lower.startsWith('/bantuan')) {
      replyHtml = this.getHelpMessage(senderName, fromChatId);
    } else if (lower.startsWith('/chatid') || lower.startsWith('/myid')) {
      replyHtml = `🆔 <b>Chat ID Anda:</b> <code>${fromChatId}</code>\n\nMasukkan ID ini di Dashboard Job Tracker untuk mengaktifkan notifikasi otomatis!`;
    } else if (lower.startsWith('/overview') || lower.startsWith('/dashboard') || lower.startsWith('/stats')) {
      replyHtml = await this.getOverviewMessage();
    } else if (lower.startsWith('/lamaran') || lower.startsWith('/loker')) {
      replyHtml = await this.getApplicationsMessage();
    } else if (lower.startsWith('/email') || lower.startsWith('/balasan')) {
      replyHtml = await this.getHrRepliesMessage();
    } else if (lower.startsWith('/tambah')) {
      replyHtml = await this.createApplicationFromTelegram(text);
    }

    if (replyHtml) {
      await this.sendTelegramMessage(fromChatId, replyHtml, 'HTML');
    }
  }

  private getHelpMessage(senderName: string, chatId: string): string {
    return `🤖 <b>JOB TRACKER TELEGRAM BOT</b>
Halo <b>${this.escapeHtml(senderName)}</b>! Selamat datang di Telegram Bot resmi Job Tracker 👋

🆔 <b>Chat ID Anda:</b> <code>${chatId}</code>

<b>📋 Daftar Perintah Interaktif:</b>

📊 <b>/overview</b> - Cek ringkasan total lamaran, breakdown status, & stage penolakan.
💼 <b>/lamaran</b> - Lihat 5 daftar lamaran kerja terbaru.
📩 <b>/email</b> - Cek 5 balasan email HRD/perusahaan terbaru.
➕ <b>/tambah [Judul] | [Perusahaan] | [Status]</b> - Tambah lamaran baru via chat!
<i>Contoh:</i> <code>/tambah Backend Developer | Tokopedia | APPLIED</code>
🆔 <b>/chatid</b> - Tampilkan Chat ID Telegram Anda.

💡 <i>Notifikasi balasan HRD akan otomatis dikirim ke sini dengan suara berdering & getar!</i>`;
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

    apps.forEach((app) => {
      const st = app.status;
      if (statusCounts[st] !== undefined) statusCounts[st]++;
    });

    return `📊 <b>OVERVIEW DASHBOARD LAMARAN</b>

📋 <b>Total Lamaran:</b> ${totalApps}

📌 <b>Breakdown Status:</b>
- APPLIED: ${statusCounts.APPLIED}
- ASSESSMENT: ${statusCounts.ASSESSMENT}
- HR INTERVIEW: ${statusCounts.HR_INTERVIEW}
- USER INTERVIEW: ${statusCounts.USER_INTERVIEW}
- OFFER: ${statusCounts.OFFER}
- REJECTED: ${statusCounts.REJECTED}`;
  }

  private async getApplicationsMessage(): Promise<string> {
    const userId = await this.getPrimaryUserId();
    const apps = await this.prisma.application.findMany({
      where: { userId },
      include: { company: true },
      orderBy: { appliedAt: 'desc' },
      take: 5,
    });

    if (apps.length === 0) {
      return `💼 Belum ada data lamaran kerja terdaftar.`;
    }

    let msg = `💼 <b>5 LAMARAN KERJA TERBARU:</b>\n\n`;
    apps.forEach((app, i) => {
      const dateStr = app.appliedAt ? new Date(app.appliedAt).toLocaleDateString('id-ID') : '-';
      const companyName = app.company?.name || 'Perusahaan';
      msg += `${i + 1}. <b>${this.escapeHtml(app.jobTitle)}</b> - ${this.escapeHtml(companyName)}\n`;
      msg += `   Status: <code>${app.status}</code> | Tanggal: ${dateStr}\n\n`;
    });

    return msg;
  }

  private async getHrRepliesMessage(): Promise<string> {
    const userId = await this.getPrimaryUserId();
    const emails = await this.prisma.emailMessage.findMany({
      where: { userId, isJobRelated: true },
      orderBy: { receivedAt: 'desc' },
      take: 5,
    });

    if (emails.length === 0) {
      return `📩 Belum ada balasan email HRD terdeteksi.`;
    }

    let msg = `📩 <b>5 BALASAN EMAIL HRD TERBARU:</b>\n\n`;
    emails.forEach((em, i) => {
      const dateStr = new Date(em.receivedAt).toLocaleDateString('id-ID');
      msg += `${i + 1}. <b>${this.escapeHtml(em.subject)}</b>\n`;
      msg += `   Dari: <code>${this.escapeHtml(em.fromEmail)}</code> (${dateStr})\n\n`;
    });

    return msg;
  }

  private async createApplicationFromTelegram(text: string): Promise<string> {
    const raw = text.replace(/^\/tambah/i, '').trim();
    if (!raw) {
      return `⚠️ <b>Format Salah!</b>\nGunakan format: <code>/tambah [Judul Pekerjaan] | [Nama Perusahaan] | [Status (Opsional)]</code>\nContoh: <code>/tambah Backend Developer | Tokopedia | APPLIED</code>`;
    }

    const parts = raw.split('|').map((s) => s.trim());
    if (parts.length < 2) {
      return `⚠️ <b>Format Salah!</b> Harus menyertakan Judul & Perusahaan yang dipisahkan simbol |.`;
    }

    const jobTitle = parts[0];
    const companyName = parts[1];
    let statusStr = parts[2] ? parts[2].toUpperCase() : 'APPLIED';
    const validStatuses = ['SAVED', 'APPLIED', 'ASSESSMENT', 'HR_INTERVIEW', 'USER_INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN'];
    if (!validStatuses.includes(statusStr)) statusStr = 'APPLIED';

    const userId = await this.getPrimaryUserId();
    let company = await this.prisma.company.findFirst({ where: { name: { equals: companyName, mode: 'insensitive' } } });
    if (!company) {
      company = await this.prisma.company.create({ data: { name: companyName } });
    }

    const newApp = await this.prisma.application.create({
      data: {
        userId,
        companyId: company.id,
        jobTitle,
        status: statusStr as ApplicationStatus,
        appliedAt: new Date(),
      },
    });

    return `✅ <b>BERHASIL MENAMBAHKAN LAMARAN!</b>\n\n📌 <b>Pekerjaan:</b> ${this.escapeHtml(newApp.jobTitle)}\n🏢 <b>Perusahaan:</b> ${this.escapeHtml(company.name)}\n📊 <b>Status:</b> <code>${newApp.status}</code>`;
  }

  private escapeHtml(str: string): string {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
