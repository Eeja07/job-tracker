import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanDatabase, TestAppSetup } from './test-utils';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AppController (e2e)', () => {
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
    if (prisma) await cleanDatabase(prisma);
    if (app) await app.close();
  });

  it('GET /api/v1 should return Hello World!', async () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect('Hello World!');
  });
});
