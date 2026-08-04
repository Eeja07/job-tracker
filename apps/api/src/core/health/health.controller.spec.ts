import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../modules/redis/redis.service';
import { QueueService } from '../../modules/jobs/services/queue.service';
import { EmailService } from '../../modules/email/services/email.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prismaService: jest.Mocked<PrismaService>;
  let redisService: jest.Mocked<RedisService>;
  let queueService: jest.Mocked<QueueService>;
  let emailService: jest.Mocked<EmailService>;

  beforeEach(async () => {
    const mockPrisma = {
      $queryRaw: jest.fn(),
    };

    const mockRedis = {
      ping: jest.fn().mockResolvedValue('PONG'),
    };

    const mockQueueService = {
      checkHealth: jest.fn().mockResolvedValue(true),
    };

    const mockEmailService = {
      verifyConnection: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: QueueService, useValue: mockQueueService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    prismaService = module.get(PrismaService);
    redisService = module.get(RedisService);
    queueService = module.get(QueueService);
    emailService = module.get(EmailService);
  });

  describe('check', () => {
    it('should return ok status and checks when Redis, Jobs, SMTP, and Audit Queue are up', async () => {
      const response = await controller.check();
      expect(response.status).toBe('ok');
      expect(response.checks).toEqual({
        redis: 'up',
        jobs: 'up',
        smtp: 'up',
        auditQueue: 'up',
        rbacCache: 'up',
      });
    });
  });

  describe('liveness', () => {
    it('should return ok for liveness probe', () => {
      const response = controller.liveness();
      expect(response.status).toBe('ok');
    });
  });

  describe('readiness', () => {
    it('should return ok with database, redis, jobs, smtp, and auditQueue checks when all are connected', async () => {
      prismaService.$queryRaw.mockResolvedValue([{ 1: 1 }] as never);
      redisService.ping.mockResolvedValue('PONG');
      queueService.checkHealth.mockResolvedValue(true);
      emailService.verifyConnection.mockResolvedValue(true);

      const response = await controller.readiness();
      expect(response.status).toBe('ok');
      expect(response.checks).toEqual({
        database: 'up',
        redis: 'up',
        jobs: 'up',
        smtp: 'up',
        auditQueue: 'up',
        rbacCache: 'up',
      });
    });

    it('should return degraded status when Redis ping fails but DB is up', async () => {
      prismaService.$queryRaw.mockResolvedValue([{ 1: 1 }] as never);
      redisService.ping.mockRejectedValue(new Error('Redis down'));
      queueService.checkHealth.mockResolvedValue(true);
      emailService.verifyConnection.mockResolvedValue(true);

      const response = await controller.readiness();
      expect(response.status).toBe('degraded');
      expect(response.checks).toEqual({
        database: 'up',
        redis: 'down',
        jobs: 'up',
        smtp: 'up',
        auditQueue: 'up',
        rbacCache: 'down',
      });
    });

    it('should throw ServiceUnavailableException when DB check fails', async () => {
      prismaService.$queryRaw.mockRejectedValue(new Error('DB error') as never);

      await expect(controller.readiness()).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('startup', () => {
    it('should return ok for startup probe', () => {
      const response = controller.startup();
      expect(response.status).toBe('ok');
    });
  });
});
