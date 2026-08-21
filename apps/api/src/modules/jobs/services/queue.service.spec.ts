import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { QUEUE_NAMES } from '../constants/jobs.constants';
import { NotFoundException } from '@nestjs/common';

describe('QueueService', () => {
  let service: QueueService;
  let mockEmailQueue: any;
  let mockAttachmentQueue: any;
  let mockNotificationQueue: any;
  let mockSystemQueue: any;
  let mockDeadLetterQueue: any;

  beforeEach(async () => {
    const createMockQueue = () => ({
      add: jest
        .fn()
        .mockImplementation((jobName, data, opts) =>
          Promise.resolve({ id: 'job-123', name: jobName, data, opts }),
        ),
      getJob: jest.fn(),
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 2,
        active: 1,
        delayed: 0,
        completed: 10,
        failed: 1,
      }),
      close: jest.fn().mockResolvedValue(undefined),
      client: Promise.resolve({
        ping: jest.fn().mockResolvedValue('PONG'),
      }),
    });

    mockEmailQueue = createMockQueue();
    mockAttachmentQueue = createMockQueue();
    mockNotificationQueue = createMockQueue();
    mockSystemQueue = createMockQueue();
    mockDeadLetterQueue = createMockQueue();
    const mockAuditQueue = createMockQueue();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        { provide: getQueueToken(QUEUE_NAMES.EMAIL), useValue: mockEmailQueue },
        {
          provide: getQueueToken(QUEUE_NAMES.ATTACHMENT),
          useValue: mockAttachmentQueue,
        },
        {
          provide: getQueueToken(QUEUE_NAMES.NOTIFICATION),
          useValue: mockNotificationQueue,
        },
        {
          provide: getQueueToken(QUEUE_NAMES.SYSTEM),
          useValue: mockSystemQueue,
        },
        {
          provide: getQueueToken(QUEUE_NAMES.DEAD_LETTER),
          useValue: mockDeadLetterQueue,
        },
        {
          provide: getQueueToken(QUEUE_NAMES.AUDIT),
          useValue: mockAuditQueue,
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('enqueue', () => {
    it('should add job with default retry and backoff options to target queue', async () => {
      const job = await service.enqueue(
        QUEUE_NAMES.EMAIL,
        'SEND_WELCOME_EMAIL',
        { email: 'user@test.com' },
      );

      expect(mockEmailQueue.add).toHaveBeenCalledWith(
        'SEND_WELCOME_EMAIL',
        { email: 'user@test.com' },
        expect.objectContaining({
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnFail: false,
        }),
      );
      expect(job.id).toBe('job-123');
    });

    it('should throw NotFoundException for unregistered queue', async () => {
      await expect(
        service.enqueue('unknown-queue', 'JOB_NAME', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('enqueueDelayed', () => {
    it('should add job with delay option', async () => {
      await service.enqueueDelayed(
        QUEUE_NAMES.SYSTEM,
        'CLEANUP_TEMP_FILES',
        { olderThanDays: 7 },
        5000,
      );

      expect(mockSystemQueue.add).toHaveBeenCalledWith(
        'CLEANUP_TEMP_FILES',
        { olderThanDays: 7 },
        expect.objectContaining({ delay: 5000 }),
      );
    });
  });

  describe('enqueueRepeatable', () => {
    it('should add job with repeat pattern', async () => {
      await service.enqueueRepeatable(
        QUEUE_NAMES.SYSTEM,
        'GENERATE_WEEKLY_REPORT',
        { userId: 'u1' },
        '0 0 * * 0',
      );

      expect(mockSystemQueue.add).toHaveBeenCalledWith(
        'GENERATE_WEEKLY_REPORT',
        { userId: 'u1' },
        expect.objectContaining({ repeat: { pattern: '0 0 * * 0' } }),
      );
    });
  });

  describe('remove & getJob', () => {
    it('should remove existing job', async () => {
      const mockJob = { remove: jest.fn().mockResolvedValue(undefined) };
      mockAttachmentQueue.getJob.mockResolvedValue(mockJob);

      await service.remove(QUEUE_NAMES.ATTACHMENT, 'job-999');

      expect(mockAttachmentQueue.getJob).toHaveBeenCalledWith('job-999');
      expect(mockJob.remove).toHaveBeenCalled();
    });

    it('should return job by ID', async () => {
      const mockJob = { id: 'job-555', name: 'SCAN_ATTACHMENT' };
      mockAttachmentQueue.getJob.mockResolvedValue(mockJob);

      const job = await service.getJob(QUEUE_NAMES.ATTACHMENT, 'job-555');

      expect(job).toBe(mockJob);
    });
  });

  describe('moveToDeadLetterQueue', () => {
    it('should enqueue failed job details to dead-letter queue', async () => {
      await service.moveToDeadLetterQueue({
        originalQueue: QUEUE_NAMES.EMAIL,
        jobName: 'SEND_WELCOME_EMAIL',
        data: { email: 'bad@test.com' },
        failedReason: 'SMTP Connection Refused',
        attemptsMade: 5,
        timestamp: '2026-08-04T12:00:00Z',
      });

      expect(mockDeadLetterQueue.add).toHaveBeenCalledWith(
        'PROCESS_DEAD_LETTER',
        expect.objectContaining({
          originalQueue: QUEUE_NAMES.EMAIL,
          failedReason: 'SMTP Connection Refused',
        }),
        expect.objectContaining({ attempts: 1 }),
      );
    });
  });

  describe('Metrics & Health', () => {
    it('should collect queue metrics', async () => {
      const metrics = await service.getQueueMetrics(QUEUE_NAMES.EMAIL);
      expect(metrics).toEqual({
        waiting: 2,
        active: 1,
        delayed: 0,
        completed: 10,
        failed: 1,
      });
    });

    it('should collect all queue metrics', async () => {
      const allMetrics = await service.getAllMetrics();
      expect(allMetrics).toHaveProperty(QUEUE_NAMES.EMAIL);
      expect(allMetrics).toHaveProperty(QUEUE_NAMES.ATTACHMENT);
      expect(allMetrics).toHaveProperty(QUEUE_NAMES.NOTIFICATION);
      expect(allMetrics).toHaveProperty(QUEUE_NAMES.SYSTEM);
      expect(allMetrics).toHaveProperty(QUEUE_NAMES.DEAD_LETTER);
    });

    it('should verify health status across queues', async () => {
      const isHealthy = await service.checkHealth();
      expect(isHealthy).toBe(true);
    });
  });
});
