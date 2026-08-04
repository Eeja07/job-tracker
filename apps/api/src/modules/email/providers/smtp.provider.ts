import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailProvider, SendEmailOptions, SendEmailResult } from '../interfaces/email-provider.interface';

@Injectable()
export class SMTPProvider implements EmailProvider {
  private readonly logger = new Logger(SMTPProvider.name);
  private transporter: nodemailer.Transporter;
  private readonly defaultFrom: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST') || 'localhost';
    const port = this.configService.get<number>('SMTP_PORT') || 587;
    const username = this.configService.get<string>('SMTP_USERNAME') || '';
    const password = this.configService.get<string>('SMTP_PASSWORD') || '';
    this.defaultFrom = this.configService.get<string>('SMTP_FROM') || '"Job Tracker" <noreply@jobtracker.io>';

    const auth = username ? { user: username, pass: password } : undefined;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth,
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const mailOptions = {
      from: options.from || this.defaultFrom,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments?.map((att) => ({
        filename: att.filename,
        content: att.content,
        path: att.path,
        contentType: att.contentType,
      })),
    };

    const info = await this.transporter.sendMail(mailOptions);
    this.logger.log(`Email sent successfully to ${mailOptions.to} (MessageId: ${info.messageId})`);
    return { messageId: info.messageId || `msg-${Date.now()}` };
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (err: any) {
      this.logger.warn(`SMTP connection verification failed: ${err.message}`);
      return false;
    }
  }
}
