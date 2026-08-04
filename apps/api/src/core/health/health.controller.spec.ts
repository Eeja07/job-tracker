import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../modules/redis/redis.service';
import { QueueService } from '../../modules/jobs/services/queue.service';
import { EmailService } from '../../modules/email/services/email.service';
import { StorageService } from '../../modules/storage/storage.service';
import { FeatureFlagService } from '../../modules/feature-flags/services/feature-flag.service';
import { EventBusService } from '../../modules/event-bus/services/event-bus.service';
import { ConnectionManager } from '../../modules/websocket/services/connection-manager.service';

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

    const mockStorageService = {
      fileExists: jest.fn().mockResolvedValue(true),
    };

    const mockFeatureFlagService = {
      get: jest.fn().mockResolvedValue(null),
    };

    const mockEventBusService = {
      isReady: jest.fn().mockReturnValue(true),
    };

    const mockConnectionManager = {
      getConnectionCount: jest.fn().mockReturnValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: QueueService, useValue: mockQueueService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: FeatureFlagService, useValue: mockFeatureFlagService },
        { provide: EventBusService, useValue: mockEventBusService },
        { provide: ConnectionManager, useValue: mockConnectionManager },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    prismaService = module.get(PrismaService);
    redisService = module.get(RedisService);
    queueService = module.get(QueueService);
    emailService = module.get(EmailService);
  });

  describe('check', () => {
    it('should return ok status and all checks when services are up', async () => {
      const response = await controller.check();
      expect(response.status).toBe('ok');
      expect(response.checks).toEqual({
        redis: 'up',
        jobs: 'up',
        smtp: 'up',
        auditQueue: 'up',
        rbacCache: 'up',
        storage: 'up',
        virusScanner: 'up',
        featureFlags: 'up',
        eventBus: 'up',
        publisher: 'up',
        subscriber: 'up',
        redisPubSub: 'up',
        websocket: 'up',
        socketio: 'up',
        redisAdapter: 'up',
        presence: 'up',
        tracing: 'down',
        otlpExporter: 'up',
        jaegerExporter: 'up',
        projection: 'down',
        readModel: 'down',
        cqrs: 'down',
        apiVersioning: 'up',
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
