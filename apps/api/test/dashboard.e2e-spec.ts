import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanDatabase, TestAppSetup } from './test-utils';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Dashboard Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let setup: TestAppSetup;

  let accessToken: string;

  beforeAll(async () => {
    setup = await createTestApp();
    app = setup.app;
    prisma = setup.prisma;
    await cleanDatabase(prisma);

    // Register User
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'dashboard-test@example.com',
        password: 'Password123!',
        fullName: 'Dashboard User',
      });
    accessToken = res.body.accessToken;

    // Create Company
    const compRes = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Bukalapak', industry: 'E-Commerce' });

    // Create 2 Applications
    await request(app.getHttpServer())
      .post('/api/v1/applications')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        companyId: compRes.body.id,
        jobTitle: 'Backend Engineer',
        status: 'APPLIED',
        source: 'LINKEDIN',
      });

    await request(app.getHttpServer())
      .post('/api/v1/applications')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        companyId: compRes.body.id,
        jobTitle: 'Frontend Engineer',
        status: 'SAVED',
        source: 'GLINTS',
      });
  });

  afterAll(async () => {
    if (prisma) await cleanDatabase(prisma);
    if (app) await app.close();
  });

  it('GET /api/v1/dashboard should reject unauthenticated requests with 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/dashboard').expect(401);
  });

  it('GET /api/v1/dashboard should return aggregated user metrics envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/dashboard')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.totalApplications).toBe(2);
    expect(response.body.pipelineDistribution).toHaveProperty('APPLIED', 1);
    expect(response.body.pipelineDistribution).toHaveProperty('SAVED', 1);
    expect(response.body).toHaveProperty('offerRate');
    expect(response.body).toHaveProperty('interviewRate');
    expect(response.body).toHaveProperty('monthlyTrend');
  });
});
