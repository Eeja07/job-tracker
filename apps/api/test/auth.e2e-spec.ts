import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanDatabase, TestAppSetup } from './test-utils';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Authentication Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let setup: TestAppSetup;

  let accessToken: string;
  let refreshToken: string;

  const testUser = {
    email: 'auth-test@example.com',
    password: 'Password123!',
    fullName: 'Auth Test User',
  };

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

  it('POST /api/v1/auth/register should create a new user and return tokens', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(testUser)
      .expect(201);

    expect(response.body).toHaveProperty('accessToken');
    expect(response.body).toHaveProperty('refreshToken');
    expect(response.body.user).toHaveProperty('email', testUser.email);
    expect(response.body.user).toHaveProperty('fullName', testUser.fullName);
    expect(response.body.user).not.toHaveProperty('passwordHash');

    accessToken = response.body.accessToken;
    refreshToken = response.body.refreshToken;
  });

  it('POST /api/v1/auth/register should fail with 409 Conflict for existing email', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(testUser)
      .expect(409);

    expect(response.body.statusCode).toBe(409);
    expect(response.body.message).toContain('Email is already registered');
  });

  it('POST /api/v1/auth/login should fail with 401 Unauthorized for wrong password', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: 'WrongPassword!' })
      .expect(401);

    expect(response.body.statusCode).toBe(401);
  });

  it('POST /api/v1/auth/login should succeed with correct credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    expect(response.body).toHaveProperty('accessToken');
    expect(response.body).toHaveProperty('refreshToken');
    accessToken = response.body.accessToken;
    refreshToken = response.body.refreshToken;
  });

  it('GET /api/v1/auth/me should return user profile with valid Bearer token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('email', testUser.email);
    expect(response.body).toHaveProperty('fullName', testUser.fullName);
  });

  it('GET /api/v1/auth/me should fail with 401 without Bearer token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401);
  });

  it('POST /api/v1/auth/refresh should issue new tokens given valid refresh token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(response.body).toHaveProperty('accessToken');
    expect(response.body).toHaveProperty('refreshToken');
    accessToken = response.body.accessToken;
    refreshToken = response.body.refreshToken;
  });

  it('POST /api/v1/auth/logout should invalidate refresh session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // Refreshing after logout should fail
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });
});
