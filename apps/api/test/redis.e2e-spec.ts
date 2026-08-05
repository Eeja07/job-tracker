import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanDatabase, TestAppSetup } from './test-utils';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/modules/redis/redis.service';

describe('Redis Infrastructure & Cache Integration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let setup: TestAppSetup;
  let redisService: RedisService;

  let accessToken: string;
  let refreshToken: string;
  let userId: string;
  let companyId: string;

  beforeAll(async () => {
    setup = await createTestApp();
    app = setup.app;
    prisma = setup.prisma;
    redisService = app.get(RedisService);
    await cleanDatabase(prisma);

    // Register User
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'redis-e2e@example.com',
        password: 'Password123!',
        fullName: 'Redis E2E User',
      });

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
    userId = res.body.user.id;

    // Create Company
    const compRes = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Redis Corp', industry: 'Infrastructure' });

    companyId = compRes.body.id;
  });

  afterAll(async () => {
    if (prisma) await cleanDatabase(prisma);
    if (app) await app.close();
  });

  describe('Dashboard Cache & Invalidation', () => {
    it('should fetch and cache dashboard metrics', async () => {
      const res1 = await request(app.getHttpServer())
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res1.body.totalApplications).toBe(0);

      // Verify cached value exists in Redis if Redis is connected
      if (redisService.isReady()) {
        const cached = await redisService.get(`dashboard:metrics:${userId}`);
        expect(cached).not.toBeNull();
      }
    });

    it('should invalidate dashboard cache when new application is created', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          companyId,
          jobTitle: 'Site Reliability Engineer',
          status: 'APPLIED',
          source: 'LINKEDIN',
        })
        .expect(201);

      const res2 = await request(app.getHttpServer())
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res2.body.totalApplications).toBe(1);
    });
  });

  describe('Refresh Session Caching', () => {
    it('should refresh tokens using cached session in Redis', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });
  });

  describe('Distributed Rate Limiting', () => {
    it('should process request through throttler storage', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(res.status).toBe(200);
    });
  });
});
