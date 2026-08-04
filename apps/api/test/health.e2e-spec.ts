import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanDatabase, TestAppSetup } from './test-utils';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Health & Observability (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let setup: TestAppSetup;

  beforeAll(async () => {
    setup = await createTestApp();
    app = setup.app;
    prisma = setup.prisma;
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  it('GET /api/v1/health should return overall health status', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('checks');
  });

  it('GET /api/v1/health/live should return liveness probe status', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'ok');
  });

  it('GET /api/v1/health/ready should verify database and redis connection readiness', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200);

    expect(response.body).toHaveProperty('status');
    expect(response.body.checks).toHaveProperty('database', 'up');
    expect(response.body.checks).toHaveProperty('redis');
  });

  it('GET /api/v1/health/startup should return startup probe status', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/startup')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'ok');
  });

  it('GET /api/v1/metrics should expose Prometheus text metrics including redis metrics', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/metrics')
      .expect(200);

    expect(response.text).toContain('active_requests');
    expect(response.text).toContain('http_requests_total');
    expect(response.text).toContain('redis_connected');
    expect(response.text).toContain('redis_hit_ratio');
  });
});
