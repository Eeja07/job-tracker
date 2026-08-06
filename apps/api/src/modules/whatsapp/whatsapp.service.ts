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

  async sendTextMessage(to: string, message: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.gatewayUrl}/api/v1/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.apiKey,
        },
        body: JSON.stringify({ to, message }),
      });
      const data = (await response.json()) as { success?: boolean };
      return data.success === true;
    } catch (err: any) {
      this.logger.error(`Failed to send WhatsApp message to ${to}: ${err.message}`);
      return false;
    }
  }

  private async getUserPhone(userId: string): Promise<string | null> {
    // Uses environment variable fallback or configured WA notification target phone
    return process.env.WA_NOTIFICATION_PHONE || null;
  }

  async notifyEmailNotification(userId: string, title: string, body: string): Promise<void> {
    const phone = await this.getUserPhone(userId);
    if (!phone) return;

    const messageText = `🔔 *JOB TRACKER NOTIFIKASI*\n\n📩 *${title}*\n${body}\n\n🔗 _Akses Dashboard:_ https://job.eeja.fun/dashboard/gmail`;
    await this.sendTextMessage(phone, messageText);
  }

  async handleIncomingWebhook(payload: { from: string; body: string; pushName?: string }): Promise<void> {
    const { from, body, pushName } = payload;
    const text = (body || '').trim();
    if (!text || !from) return;

    this.logger.log(`Processing WA Bot Command from ${from} (${pushName}): ${text}`);
    const lower = text.toLowerCase();
    let reply = '';

    if (lower.startsWith('!help') || lower.startsWith('!bantuan') || lower === 'help' || lower === 'menu') {
      reply = this.getHelpMessage(pushName);
    } else if (lower.startsWith('!overview') || lower.startsWith('!dashboard') || lower.startsWith('!stats')) {
      reply = await this.getOverviewMessage();
    } else if (lower.startsWith('!loker') || lower.startsWith('!lamaran')) {
      reply = await this.getApplicationsMessage();
    } else if (lower.startsWith('!email') || lower.startsWith('!balasan')) {
      reply = await this.getHrRepliesMessage();
    } else if (lower.startsWith('!tambah')) {
      reply = await this.createApplicationFromWa(text);
    } else {
      reply = `🤖 *JOB TRACKER BOT*\n\nHalo ${pushName || 'User'}! Ketik *!help* untuk melihat daftar perintah WhatsApp Bot Job Tracker.`;
    }

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

  private async getOverviewMessage(): Promise<string> {
    const totalApps = await this.prisma.application.count();
    const apps = await this.prisma.application.findMany();

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
      CV: 0,
      ASSESSMENT: 0,
      HR: 0,
      USER: 0,
      OFFERING: 0,
    };

    apps.forEach((app) => {
      const st = app.status;
      if (statusCounts[st] !== undefined) {
        statusCounts[st]++;
      }
      if (st === 'REJECTED') {
        const stage = app.rejectedAtStage || 'CV';
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
• CV Screening: ${rejectionCounts.CV}
• Assessment / Tes: ${rejectionCounts.ASSESSMENT}
• HR Interview: ${rejectionCounts.HR}
• User Interview: ${rejectionCounts.USER}
• Offering: ${rejectionCounts.OFFERING}

🔗 _Dashboard Web:_ https://job.eeja.fun/dashboard`;
  }

  private async getApplicationsMessage(): Promise<string> {
    const apps = await this.prisma.application.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: { company: true },
    });

    if (apps.length === 0) {
      return `💼 *DAFTAR LAMARAN KERJA*\n\nBelum ada lamaran kerja yang terdaftar. Ketik *!tambah* untuk menambahkan lamaran baru!`;
    }

    let msg = `💼 *5 LAMARAN KERJA TERBARU*\n\n`;
    apps.forEach((app, idx) => {
      msg += `${idx + 1}. *${app.jobTitle}*\n   🏢 Perusahaan: ${app.company?.name || 'N/A'}\n   📌 Status: *${app.status}*\n   📅 Diubah: ${new Date(app.updatedAt).toLocaleDateString('id-ID')}\n\n`;
    });

    msg += `🔗 _Lihat Semua Lamaran:_ https://job.eeja.fun/dashboard/applications`;
    return msg;
  }

  private async getHrRepliesMessage(): Promise<string> {
    const messages = await this.prisma.emailMessage.findMany({
      where: { isJobRelated: true },
      orderBy: { receivedAt: 'desc' },
      take: 5,
    });

    if (messages.length === 0) {
      return `📩 *BALASAN EMAIL HRD*\n\nBelum ada balasan email HRD ber-kategori loker yang terdeteksi.`;
    }

    let msg = `📩 *5 BALASAN EMAIL HRD TERBARU*\n\n`;
    messages.forEach((m, idx) => {
      msg += `${idx + 1}. *${m.subject || 'Tanpa Subjek'}*\n   👤 Dari: ${m.fromName || m.fromEmail}\n   🏷️ Tipe: *${m.detectedType || 'EMAIL_JOB'}*\n   📅 Waktu: ${new Date(m.receivedAt).toLocaleString('id-ID')}\n\n`;
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

    // Get first user in DB to assign application
    const user = await this.prisma.user.findFirst();
    if (!user) {
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
        userId: user.id,
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
