import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanDatabase, TestAppSetup } from './test-utils';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/modules/jobs/services/queue.service';
import {
  QUEUE_NAMES,
  EmailJobName,
  SystemJobName,
} from '../src/modules/jobs/constants/jobs.constants';

describe('Background Jobs & BullMQ Infrastructure (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let setup: TestAppSetup;
  let queueService: QueueService;
  let isQueueAvailable = false;

  beforeAll(async () => {
    setup = await createTestApp();
    app = setup.app;
    prisma = setup.prisma;
    queueService = app.get(QueueService);
    await cleanDatabase(prisma);
    isQueueAvailable = await queueService.checkHealth();
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('Enqueue & Retrieve Jobs', () => {
    it('should enqueue and retrieve a background job when Redis queue is available', async () => {
      if (!isQueueAvailable) {
        expect(isQueueAvailable).toBe(false);
        return;
      }

      const job = await queueService.enqueue(
        QUEUE_NAMES.EMAIL,
        EmailJobName.SEND_WELCOME_EMAIL,
        { userId: 'e2e-user', email: 'e2e@example.com', fullName: 'E2E User' },
      );

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();

      const retrievedJob = await queueService.getJob(
        QUEUE_NAMES.EMAIL,
        job.id!,
      );
      expect(retrievedJob).toBeDefined();
      expect(retrievedJob?.name).toBe(EmailJobName.SEND_WELCOME_EMAIL);
    });

    it('should enqueue delayed jobs when Redis queue is available', async () => {
      if (!isQueueAvailable) {
        expect(isQueueAvailable).toBe(false);
        return;
      }

      const delayedJob = await queueService.enqueueDelayed(
        QUEUE_NAMES.SYSTEM,
        SystemJobName.CLEANUP_TEMP_FILES,
        { olderThanDays: 14 },
        60000,
      );

      expect(delayedJob).toBeDefined();
      expect(delayedJob.opts.delay).toBe(60000);
    });
  });

  describe('Queue Metrics & Observability Integration', () => {
    it('should fetch queue metrics via QueueService', async () => {
      const metrics = await queueService.getQueueMetrics(QUEUE_NAMES.EMAIL);
      expect(metrics).toHaveProperty('waiting');
      expect(metrics).toHaveProperty('active');
      expect(metrics).toHaveProperty('delayed');
      expect(metrics).toHaveProperty('completed');
      expect(metrics).toHaveProperty('failed');
    });

    it('should include queue metrics in GET /api/v1/metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/metrics')
        .expect(200);

      expect(response.text).toContain('queue_waiting');
      expect(response.text).toContain('queue_active');
      expect(response.text).toContain('queue_completed');
      expect(response.text).toContain('queue_failed');
    });
  });

  describe('Health Probes with Queue Connectivity', () => {
    it('should include queue health status in GET /api/v1/health/ready', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(200);

      expect(response.body.checks).toHaveProperty('jobs');
    });
  });
});
