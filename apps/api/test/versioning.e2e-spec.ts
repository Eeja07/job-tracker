import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanDatabase, TestAppSetup } from './test-utils';

describe('API Versioning & Deprecation Strategy (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const setup: TestAppSetup = await createTestApp();
    app = setup.app;
    await cleanDatabase(setup.prisma);

    const regRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'versioning-user@example.com',
        password: 'Password123!',
        fullName: 'Versioning Test User',
      });

    authToken = `Bearer ${regRes.body.accessToken}`;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('URI Versioning & Deprecation Headers', () => {
    it('GET /api/v1/applications should return v1 results and include Deprecation/Sunset headers', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/applications')
        .set('Authorization', authToken);

      expect(res.status).toBe(200);
      expect(res.headers['deprecation']).toBe('true');
      expect(res.headers['sunset']).toBeDefined();
    });

    it('GET /api/v2/applications should return v2 envelope structure without deprecation warning', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v2/applications')
        .set('Authorization', authToken);

      expect(res.status).toBe(200);
      expect(res.body.version).toBe('v2');
      expect(res.body.items).toBeDefined();
      expect(res.headers['deprecation']).toBeUndefined();
    });
  });

  describe('Header Versioning', () => {
    it('GET /api/applications with X-API-Version: 2 should route to v2', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/applications')
        .set('Authorization', authToken)
        .set('X-API-Version', '2');

      expect(res.status).toBe(200);
      expect(res.body.version).toBe('v2');
    });
  });

  describe('Media Type (Accept Header) Versioning', () => {
    it('GET /api/applications with Accept: application/json;version=2 should route to v2', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/applications')
        .set('Authorization', authToken)
        .set('Accept', 'application/json;version=2');

      expect(res.status).toBe(200);
      expect(res.body.version).toBe('v2');
    });
  });
});
