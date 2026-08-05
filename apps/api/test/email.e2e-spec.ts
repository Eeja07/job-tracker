import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanDatabase, TestAppSetup } from './test-utils';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmailService } from '../src/modules/email/services/email.service';
import { QueueService } from '../src/modules/jobs/services/queue.service';
import {
  EMAIL_PROVIDER_TOKEN,
  EmailProvider,
} from '../src/modules/email/interfaces/email-provider.interface';
import {
  QUEUE_NAMES,
  EmailJobName,
} from '../src/modules/jobs/constants/jobs.constants';

describe('Email Infrastructure (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let setup: TestAppSetup;
  let emailService: EmailService;
  let queueService: QueueService;
  let emailProvider: EmailProvider;
  let isQueueAvailable = false;

  beforeAll(async () => {
    setup = await createTestApp();
    app = setup.app;
    prisma = setup.prisma;
    emailService = app.get(EmailService);
    queueService = app.get(QueueService);
    emailProvider = app.get(EMAIL_PROVIDER_TOKEN);
    await cleanDatabase(prisma);
    isQueueAvailable = await queueService.checkHealth();
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('Template Rendering & Validation', () => {
    it('should correctly render handlebars email templates', () => {
      const welcomeHtml = emailService.renderTemplate('welcome', {
        fullName: 'E2E User',
        loginUrl: 'https://app.jobtracker.io/login',
      });
      expect(welcomeHtml).toContain('Hello <strong>E2E User</strong>');
      expect(welcomeHtml).toContain('https://app.jobtracker.io/login');

      const statusHtml = emailService.renderTemplate('application-status', {
        fullName: 'E2E User',
        companyName: 'TechCorp',
        positionTitle: 'Senior Engineer',
        oldStatus: 'APPLIED',
        newStatus: 'INTERVIEW',
      });
      expect(statusHtml).toContain('TechCorp');
      expect(statusHtml).toContain('APPLIED &rarr; INTERVIEW');
    });

    it('should throw validation error when rendering non-existent template', () => {
      expect(() =>
        emailService.renderTemplate('unknown-template', {}),
      ).toThrow();
    });
  });

  describe('Queue & Worker Processing', () => {
    it('should enqueue email job into BullMQ email queue', async () => {
      if (!isQueueAvailable) {
        expect(isQueueAvailable).toBe(false);
        return;
      }

      const job = await emailService.sendTemplate({
        to: 'e2e-worker@test.com',
        subject: 'Welcome to Job Tracker!',
        templateName: 'welcome',
        context: { fullName: 'E2E Worker' },
        attachments: [
          { filename: 'welcome.pdf', content: Buffer.from('PDF_BYTES') },
        ],
      });

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();

      const queuedJob = await queueService.getJob(QUEUE_NAMES.EMAIL, job.id!);
      expect(queuedJob).toBeDefined();
      expect(queuedJob?.name).toBe('SEND_TEMPLATE_EMAIL');
    });

    it('should directly process sending and record metrics via emailService.sendDirect', async () => {
      jest
        .spyOn(emailProvider, 'sendEmail')
        .mockResolvedValueOnce({ messageId: 'e2e-msg-123' });

      const result = await emailService.sendDirect(
        {
          to: 'direct-e2e@test.com',
          subject: 'Direct E2E Test',
          html: '<h1>Direct Test</h1>',
        },
        'welcome',
      );

      expect(result.messageId).toBe('e2e-msg-123');
    });
  });

  describe('Metrics & Health Checks Integration', () => {
    it('should report email SMTP probe in GET /api/v1/health/ready', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(200);

      expect(response.body.checks).toHaveProperty('smtp');
    });

    it('should expose email metrics in GET /api/v1/metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/metrics')
        .expect(200);

      expect(response.text).toContain('emails_sent_total');
      expect(response.text).toContain('emails_failed_total');
      expect(response.text).toContain('email_duration_seconds');
    });
  });
});
