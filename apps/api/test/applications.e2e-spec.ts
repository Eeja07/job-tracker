import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanDatabase, TestAppSetup } from './test-utils';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Applications Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let setup: TestAppSetup;

  let tokenUserA: string;
  let tokenUserB: string;
  let companyId: string;
  let applicationId: string;

  beforeAll(async () => {
    setup = await createTestApp();
    app = setup.app;
    prisma = setup.prisma;
    await cleanDatabase(prisma);

    // Register User A
    const resA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'usera@example.com',
        password: 'Password123!',
        fullName: 'User A',
      });
    tokenUserA = resA.body.accessToken;

    // Register User B
    const resB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'userb@example.com',
        password: 'Password123!',
        fullName: 'User B',
      });
    tokenUserB = resB.body.accessToken;

    // Create Company
    const compRes = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({ name: 'Traveloka', industry: 'Travel Tech' });
    companyId = compRes.body.id;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  it('POST /api/v1/applications should create application for User A', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/applications')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        companyId,
        jobTitle: 'Senior Software Engineer',
        status: 'SAVED',
        source: 'LINKEDIN',
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.jobTitle).toBe('Senior Software Engineer');
    expect(response.body.status).toBe('SAVED');
    applicationId = response.body.id;
  });

  it('GET /api/v1/applications should list User A applications', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/applications')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(1);
    expect(response.body[0].id).toBe(applicationId);
  });

  it('GET /api/v1/applications should isolate data (User B receives empty list)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/applications')
      .set('Authorization', `Bearer ${tokenUserB}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(0);
  });

  it('GET /api/v1/applications/:id should fail with 404 for User B (Ownership Check)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/applications/${applicationId}`)
      .set('Authorization', `Bearer ${tokenUserB}`)
      .expect(404);
  });

  it('PATCH /api/v1/applications/:id/status should execute valid FSM transition and record history', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/applications/${applicationId}/status`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({ status: 'APPLIED' })
      .expect(200);

    expect(response.body.status).toBe('APPLIED');

    // Verify StatusHistory record was inserted in DB
    const history = await prisma.statusHistory.findMany({
      where: { applicationId },
    });
    expect(history.length).toBe(1);
    expect(history[0].fromStatus).toBe('SAVED');
    expect(history[0].toStatus).toBe('APPLIED');
  });

  it('PATCH /api/v1/applications/:id/status should fail with 400 on invalid FSM transition', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/applications/${applicationId}/status`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({ status: 'OFFER' })
      .expect(400);

    expect(response.body.statusCode).toBe(400);
    expect(response.body.message).toContain('Invalid application status transition');
  });

  it('DELETE /api/v1/companies/:id should fail with 409 Conflict when applications reference it', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/api/v1/companies/${companyId}`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .expect(409);

    expect(response.body.statusCode).toBe(409);
    expect(response.body.message).toContain('associated with job applications');
  });

  it('DELETE /api/v1/applications/:id should delete application', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/applications/${applicationId}`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/applications/${applicationId}`)
      .set('Authorization', `Bearer ${tokenUserA}`)
      .expect(404);
  });
});
