import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SMTPProvider } from './smtp.provider';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('SMTPProvider', () => {
  let provider: SMTPProvider;
  let mockTransporter: any;

  beforeEach(async () => {
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'smtp-msg-999' }),
      verify: jest.fn().mockResolvedValue(true),
    };

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    const mockConfigService = {
      get: jest.fn((key: string) => {
        switch (key) {
          case 'SMTP_HOST':
            return 'smtp.example.com';
          case 'SMTP_PORT':
            return 587;
          case 'SMTP_USERNAME':
            return 'user';
          case 'SMTP_PASSWORD':
            return 'pass';
          case 'SMTP_FROM':
            return '"Job Tracker" <noreply@example.com>';
          default:
            return undefined;
        }
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SMTPProvider,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    provider = module.get<SMTPProvider>(SMTPProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should send email using nodemailer transporter', async () => {
    const result = await provider.sendEmail({
      to: 'recipient@test.com',
      subject: 'Test Subject',
      text: 'Test Body',
      attachments: [{ filename: 'test.pdf', content: 'data' }],
    });

    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'recipient@test.com',
        subject: 'Test Subject',
        text: 'Test Body',
        from: '"Job Tracker" <noreply@example.com>',
      }),
    );
    expect(result.messageId).toBe('smtp-msg-999');
  });

  it('should verify SMTP connection successfully', async () => {
    const isVerified = await provider.verifyConnection();
    expect(isVerified).toBe(true);
    expect(mockTransporter.verify).toHaveBeenCalled();
  });

  it('should return false when SMTP verify throws exception', async () => {
    mockTransporter.verify.mockRejectedValue(new Error('Connection refused'));
    const isVerified = await provider.verifyConnection();
    expect(isVerified).toBe(false);
  });
});
