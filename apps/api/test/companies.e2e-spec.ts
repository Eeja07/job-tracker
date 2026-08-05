import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanDatabase, TestAppSetup } from './test-utils';
import { PrismaService } from '../src/prisma/prisma.service';
import { RbacService } from '../src/modules/rbac/services/rbac.service';

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
    const userId = res.body.user.id;

    // Assign ADMIN role to test user so company management (including delete) is authorized
    const rbacService = app.get(RbacService);
    await rbacService.assignRole(userId, 'ADMIN');
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
        name: 'Gojek Tokopedia',
        industry: 'Technology',
        website: 'https://goto.com',
        location: 'Jakarta',
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe('Gojek Tokopedia');
    companyId = response.body.id;
  });

  it('GET /api/v1/companies should return list of companies', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/companies')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const list = Array.isArray(response.body)
      ? response.body
      : response.body.data;
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/companies with search should filter results', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/companies?search=goj')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const list = Array.isArray(response.body)
      ? response.body
      : response.body.data;
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('Gojek Tokopedia');
  });

  it('GET /api/v1/companies/:id should return single company details', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/companies/${companyId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.id).toBe(companyId);
    expect(response.body.name).toBe('Gojek Tokopedia');
  });

  it('PATCH /api/v1/companies/:id should update company metadata', async () => {
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
