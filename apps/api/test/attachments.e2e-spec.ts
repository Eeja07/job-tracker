import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanDatabase, TestAppSetup } from './test-utils';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Attachments Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let setup: TestAppSetup;
  let authToken: string;
  let userId: string;
  let applicationId: string;

  beforeAll(async () => {
    setup = await createTestApp();
    app = setup.app;
    prisma = setup.prisma;
    await cleanDatabase(prisma);

    // 1. Register test user
    const authRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'attachment-e2e@example.com',
        password: 'Password123!',
        fullName: 'Attachment Test User',
      });
    authToken = authRes.body.accessToken;
    userId = authRes.body.user.id;

    // 2. Create target application
    const appRes = await request(app.getHttpServer())
      .post('/api/v1/applications')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        jobTitle: 'Software Architect',
        status: 'APPLIED',
      });
    applicationId = appRes.body.id;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  let uploadedAttachmentId: string;

  it('POST /api/v1/attachments/upload should upload valid PDF file', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 sample PDF binary payload stream data');

    const res = await request(app.getHttpServer())
      .post('/api/v1/attachments/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .field('applicationId', applicationId)
      .field('type', 'CV')
      .field('label', 'Master Resume 2026')
      .field('version', '1.0')
      .attach('file', pdfBuffer, 'resume_2026.pdf');

    expect(res.status).toBe(201);
    uploadedAttachmentId = res.body.id;

    expect(res.body).toHaveProperty('id');
    expect(res.body.applicationId).toBe(applicationId);
    expect(res.body.filename).toBe('resume_2026.pdf');
    expect(res.body.mimeType).toBe('application/pdf');
    expect(res.body.storageProvider).toBe('LOCAL');
    expect(res.body.checksum).toBeDefined();
    expect(res.body.checksum.length).toBe(64);
  });

  it('POST /api/v1/attachments/upload should reject malware (EICAR signature) with 422', async () => {
    const eicarBuffer = Buffer.from('%PDF-1.4 X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');

    await request(app.getHttpServer())
      .post('/api/v1/attachments/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .field('applicationId', applicationId)
      .field('type', 'RESUME')
      .field('label', 'Infected Document')
      .attach('file', eicarBuffer, 'malware.pdf')
      .expect(422);
  });

  it('POST /api/v1/attachments/upload should reject invalid MIME type with 400', async () => {
    const textBuffer = Buffer.from('plain text content');

    await request(app.getHttpServer())
      .post('/api/v1/attachments/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .field('applicationId', applicationId)
      .field('type', 'OTHER')
      .field('label', 'Invalid file')
      .attach('file', textBuffer, 'script.txt')
      .expect(400);
  });

  it('GET /api/v1/attachments/:id/download should stream full file binary with 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/attachments/${uploadedAttachmentId}/download`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.header['content-type']).toContain('application/pdf');
    expect(res.header['content-disposition']).toContain('attachment');
    expect(res.body.toString()).toContain('%PDF-1.4 sample PDF binary payload stream data');
  });

  it('GET /api/v1/attachments/:id/download with Range header should stream partial content with 206', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/attachments/${uploadedAttachmentId}/download`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('Range', 'bytes=0-7')
      .expect(206);

    expect(res.header['content-range']).toContain('bytes 0-7/');
    expect(res.header['content-length']).toBe('8');
    expect(res.body.toString()).toBe('%PDF-1.4');
  });

  it('GET /api/v1/attachments/:id/signed-url should return 15-minute signed access URL', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/attachments/${uploadedAttachmentId}/signed-url`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('signedUrl');
    expect(res.body.expiresInSeconds).toBe(900);
    expect(res.body.signedUrl).toContain('/api/v1/attachments/signed-access');
  });

  it('GET /api/v1/attachments/signed-access should reject invalid signature with 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/attachments/signed-access?key=test.pdf&mode=GET&expires=9999999999&signature=invalid')
      .expect(401);
  });

  it('DELETE /api/v1/attachments/:id should remove metadata and physical file with 204', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/attachments/${uploadedAttachmentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(204);
  });

  it('GET /api/v1/attachments/:id after deletion should return 404', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/attachments/${uploadedAttachmentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);
  });
});
