export interface EmailAttachment {
  filename: string;
  content?: Buffer | string;
  path?: string;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  messageId: string;
}

export const EMAIL_PROVIDER_TOKEN = 'EMAIL_PROVIDER_TOKEN';

export interface EmailProvider {
  sendEmail(options: SendEmailOptions): Promise<SendEmailResult>;
  verifyConnection(): Promise<boolean>;
}
