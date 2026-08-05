import { Test, TestingModule } from '@nestjs/testing';
import { EmailWorker } from './email.worker';
import { AttachmentWorker } from './attachment.worker';
import { NotificationWorker } from './notification.worker';
import { SystemWorker } from './system.worker';
import { DeadLetterWorker } from './dead-letter.worker';
import { QueueService } from '../services/queue.service';
import { EmailService } from '../../email/services/email.service';
import {
  QUEUE_NAMES,
  EmailJobName,
  AttachmentJobName,
  SystemJobName,
} from '../constants/jobs.constants';

describe('BullMQ Workers & DLQ Retry Logic', () => {
  let emailWorker: EmailWorker;
  let attachmentWorker: AttachmentWorker;
  let notificationWorker: NotificationWorker;
  let systemWorker: SystemWorker;
  let deadLetterWorker: DeadLetterWorker;
  let queueService: jest.Mocked<QueueService>;
  let emailService: jest.Mocked<EmailService>;

  beforeEach(async () => {
    const mockQueueService = {
      moveToDeadLetterQueue: jest.fn().mockResolvedValue({ id: 'dlq-1' }),
    };

    const mockEmailService = {
      renderTemplate: jest.fn().mockReturnValue('<html>Welcome</html>'),
      sendDirect: jest.fn().mockResolvedValue({ messageId: 'msg-spec-123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailWorker,
        AttachmentWorker,
        NotificationWorker,
        SystemWorker,
        DeadLetterWorker,
        { provide: QueueService, useValue: mockQueueService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    emailWorker = module.get<EmailWorker>(EmailWorker);
    attachmentWorker = module.get<AttachmentWorker>(AttachmentWorker);
    notificationWorker = module.get<NotificationWorker>(NotificationWorker);
    systemWorker = module.get<SystemWorker>(SystemWorker);
    deadLetterWorker = module.get<DeadLetterWorker>(DeadLetterWorker);
    queueService = module.get(QueueService);
    emailService = module.get(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('EmailWorker', () => {
    it('should process welcome email job', async () => {
      const mockJob = {
        id: '1',
        name: EmailJobName.SEND_WELCOME_EMAIL,
        data: { userId: 'u1', email: 'test@domain.com', fullName: 'Test User' },
        attemptsMade: 0,
        opts: { attempts: 5 },
      } as any;

      const res = await emailWorker.process(mockJob);
      expect(res).toEqual({ messageId: 'msg-spec-123' });
      expect(emailService.renderTemplate).toHaveBeenCalledWith(
        'welcome',
        expect.any(Object),
      );
      expect(emailService.sendDirect).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@domain.com',
          subject: 'Welcome to Job Tracker!',
        }),
        'welcome',
      );
    });

    it('should move failed job to DLQ when max retry attempts reached', async () => {
      const mockJob = {
        id: '1',
        name: EmailJobName.SEND_WELCOME_EMAIL,
        data: { email: 'bad@domain.com' },
        attemptsMade: 5,
        opts: { attempts: 5 },
      } as any;

      await emailWorker.onFailed(mockJob, new Error('SMTP Timeout'));

      expect(queueService.moveToDeadLetterQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          originalQueue: QUEUE_NAMES.EMAIL,
          jobName: EmailJobName.SEND_WELCOME_EMAIL,
          failedReason: 'SMTP Timeout',
          attemptsMade: 5,
        }),
      );
    });

    it('should NOT move failed job to DLQ if retry attempts remain', async () => {
      const mockJob = {
        id: '1',
        name: EmailJobName.SEND_WELCOME_EMAIL,
        data: { email: 'retry@domain.com' },
        attemptsMade: 2,
        opts: { attempts: 5 },
      } as any;

      await emailWorker.onFailed(mockJob, new Error('Transient error'));

      expect(queueService.moveToDeadLetterQueue).not.toHaveBeenCalled();
    });
  });

  describe('AttachmentWorker', () => {
    it('should process virus scan job', async () => {
      const mockJob = {
        id: '2',
        name: AttachmentJobName.SCAN_ATTACHMENT,
        data: { attachmentId: 'att-1', fileKey: 'uploads/2026/08/04/file.pdf' },
        attemptsMade: 0,
        opts: { attempts: 5 },
      } as any;

      const res = await attachmentWorker.process(mockJob);
      expect(res).toEqual({ clean: true, attachmentId: 'att-1' });
    });
  });

  describe('SystemWorker', () => {
    it('should process cleanup temp files job', async () => {
      const mockJob = {
        id: '3',
        name: SystemJobName.CLEANUP_TEMP_FILES,
        data: { olderThanDays: 30 },
        attemptsMade: 0,
        opts: { attempts: 5 },
      } as any;

      const res = await systemWorker.process(mockJob);
      expect(res).toEqual({ status: 'completed', olderThanDays: 30 });
    });
  });

  describe('DeadLetterWorker', () => {
    it('should record dead letter job', async () => {
      const mockJob = {
        id: 'dlq-job-1',
        data: {
          originalQueue: QUEUE_NAMES.EMAIL,
          jobName: EmailJobName.SEND_WELCOME_EMAIL,
          failedReason: 'Hard fail',
          timestamp: '2026-08-04T12:00:00Z',
        },
      } as any;

      const res = await deadLetterWorker.process(mockJob);
      expect(res.status).toBe('dlq_recorded');
      expect(res.originalQueue).toBe(QUEUE_NAMES.EMAIL);
    });
  });
});
