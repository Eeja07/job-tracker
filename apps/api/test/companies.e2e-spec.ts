import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanDatabase, TestAppSetup } from './test-utils';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Companies Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let setup: TestAppSetup;

  let accessToken: string;
  let companyId: string;

  beforeAll(async () => {
    setup = await createTestApp();
    app = setup.app;
    prisma = setup.prisma;
    await cleanDatabase(prisma);

    // Register test user
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'company-test@example.com',
        password: 'Password123!',
        fullName: 'Company Test User',
      });
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  it('POST /api/v1/companies should create a new company', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Gojek',
        industry: 'On-Demand Services',
        website: 'https://gojek.com',
        location: 'Jakarta',
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe('Gojek');
    companyId = response.body.id;
  });

  it('POST /api/v1/companies should reject duplicate company name with 409', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Gojek',
      })
      .expect(409);

    expect(response.body.statusCode).toBe(409);
    expect(response.body.message).toContain('already exists');
  });

  it('GET /api/v1/companies should list companies with search and pagination', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/companies?search=goj&page=1&limit=10')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(1);
    expect(response.body[0].name).toBe('Gojek');
  });

  it('GET /api/v1/companies/:id should return details of a company', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/companies/${companyId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.id).toBe(companyId);
    expect(response.body.name).toBe('Gojek');
  });

  it('PATCH /api/v1/companies/:id should update company attributes', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/companies/${companyId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        location: 'Jakarta South',
      })
      .expect(200);

    expect(response.body.location).toBe('Jakarta South');
  });

  it('DELETE /api/v1/companies/:id should delete unreferenced company', async () => {
    // Create temporary company to delete
    const tempRes = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Temp Company' });

    const tempId = tempRes.body.id;

    await request(app.getHttpServer())
      .delete(`/api/v1/companies/${tempId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/companies/${tempId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });
});
