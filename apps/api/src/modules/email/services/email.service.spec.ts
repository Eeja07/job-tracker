import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import {
  EMAIL_PROVIDER_TOKEN,
  EmailProvider,
} from '../interfaces/email-provider.interface';
import { QueueService } from '../../jobs/services/queue.service';
import { MetricsService } from '../../../core/metrics/metrics.service';
import { BadRequestException } from '@nestjs/common';

describe('EmailService', () => {
  let service: EmailService;
  let mockEmailProvider: jest.Mocked<EmailProvider>;
  let mockQueueService: jest.Mocked<QueueService>;
  let mockMetricsService: any;

  beforeEach(async () => {
    mockEmailProvider = {
      sendEmail: jest.fn().mockResolvedValue({ messageId: 'msg-123' }),
      verifyConnection: jest.fn().mockResolvedValue(true),
    };

    mockQueueService = {
      enqueue: jest
        .fn()
        .mockImplementation((queue, job, data) =>
          Promise.resolve({ id: 'job-777', name: job, data }),
        ),
    } as any;

    mockMetricsService = {
      emailsSentTotal: { inc: jest.fn() },
      emailsFailedTotal: { inc: jest.fn() },
      emailDurationSeconds: { observe: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: EMAIL_PROVIDER_TOKEN, useValue: mockEmailProvider },
        { provide: QueueService, useValue: mockQueueService },
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('renderTemplate', () => {
    it('should render welcome template with context', () => {
      const html = service.renderTemplate('welcome', {
        fullName: 'Alice',
        loginUrl: 'https://test.com',
      });
      expect(html).toContain('Hello <strong>Alice</strong>');
      expect(html).toContain('https://test.com');
    });

    it('should render password-reset template with context', () => {
      const html = service.renderTemplate('password-reset', {
        fullName: 'Bob',
        resetLink: 'https://test.com/reset',
      });
      expect(html).toContain('Hello <strong>Bob</strong>');
      expect(html).toContain('https://test.com/reset');
    });

    it('should render application-status template with context', () => {
      const html = service.renderTemplate('application-status', {
        fullName: 'Charlie',
        companyName: 'Acme Corp',
        positionTitle: 'Software Engineer',
        oldStatus: 'APPLIED',
        newStatus: 'INTERVIEW',
      });
      expect(html).toContain('Acme Corp');
      expect(html).toContain('APPLIED &rarr; INTERVIEW');
    });

    it('should render weekly-summary template with context', () => {
      const html = service.renderTemplate('weekly-summary', {
        fullName: 'Dave',
        totalApplications: 5,
        interviewsScheduled: 2,
        offersReceived: 1,
      });
      expect(html).toContain('5');
      expect(html).toContain('2');
      expect(html).toContain('1');
    });

    it('should throw BadRequestException if template does not exist', () => {
      expect(() => service.renderTemplate('non-existent-template', {})).toThrow(
        BadRequestException,
      );
    });
  });

  describe('send & sendTemplate', () => {
    it('should enqueue raw email job', async () => {
      const job = await service.send({
        to: 'user@test.com',
        subject: 'Raw Email',
        text: 'Hello',
      });

      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        'email',
        'SEND_GENERIC_EMAIL',
        expect.objectContaining({ to: 'user@test.com', subject: 'Raw Email' }),
      );
      expect(job.id).toBe('job-777');
    });

    it('should render template and enqueue template email job with attachments support', async () => {
      const attachments = [
        { filename: 'resume.pdf', content: Buffer.from('pdf data') },
      ];
      const job = await service.sendTemplate({
        to: 'user@test.com',
        subject: 'Welcome!',
        templateName: 'welcome',
        context: { fullName: 'Eve' },
        attachments,
      });

      expect(mockQueueService.enqueue).toHaveBeenCalledWith(
        'email',
        'SEND_TEMPLATE_EMAIL',
        expect.objectContaining({
          to: 'user@test.com',
          subject: 'Welcome!',
          templateName: 'welcome',
          attachments,
        }),
      );
      expect(job.id).toBe('job-777');
    });

    it('should send bulk template emails to multiple recipients', async () => {
      const recipients = ['user1@test.com', 'user2@test.com'];
      const jobs = await service.sendBulk(
        recipients,
        'Weekly Digest',
        'weekly-summary',
        (rec) => ({
          fullName: rec,
          totalApplications: 3,
          interviewsScheduled: 1,
          offersReceived: 0,
        }),
      );

      expect(jobs.length).toBe(2);
      expect(mockQueueService.enqueue).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendDirect & Metrics', () => {
    it('should send email directly via provider and record metrics', async () => {
      const result = await service.sendDirect(
        { to: 'direct@test.com', subject: 'Direct', html: '<p>Direct</p>' },
        'welcome',
      );

      expect(mockEmailProvider.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'direct@test.com', subject: 'Direct' }),
      );
      expect(result.messageId).toBe('msg-123');
      expect(mockMetricsService.emailsSentTotal.inc).toHaveBeenCalledWith({
        template: 'welcome',
      });
      expect(
        mockMetricsService.emailDurationSeconds.observe,
      ).toHaveBeenCalled();
    });

    it('should log and record failed email metric when provider throws error', async () => {
      mockEmailProvider.sendEmail.mockRejectedValue(
        new Error('SMTP connection timed out'),
      );

      await expect(
        service.sendDirect(
          { to: 'fail@test.com', subject: 'Fail', text: 'Error' },
          'welcome',
        ),
      ).rejects.toThrow('SMTP connection timed out');

      expect(mockMetricsService.emailsFailedTotal.inc).toHaveBeenCalledWith({
        template: 'welcome',
      });
    });
  });

  describe('verifyConnection', () => {
    it('should verify connection status', async () => {
      const status = await service.verifyConnection();
      expect(status).toBe(true);
      expect(mockEmailProvider.verifyConnection).toHaveBeenCalled();
    });
  });
});
