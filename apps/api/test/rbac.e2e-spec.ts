import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanDatabase, TestAppSetup } from './test-utils';
import { PrismaService } from '../src/prisma/prisma.service';
import { RbacService } from '../src/modules/rbac/services/rbac.service';

describe('RBAC Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let setup: TestAppSetup;
  let rbacService: RbacService;

  let regularUserToken: string;
  let regularUserId: string;
  let adminUserToken: string;
  let adminUserId: string;
  let companyId: string;

  beforeAll(async () => {
    setup = await createTestApp();
    app = setup.app;
    prisma = setup.prisma;
    rbacService = app.get(RbacService);

    await cleanDatabase(prisma);

    // Seed permissions & assign to ADMIN/USER
    const companyDeletePerm = await prisma.permission.upsert({
      where: { name: 'company.delete' },
      update: {},
      create: { name: 'company.delete', description: 'Delete company' },
    });
    const companyCreatePerm = await prisma.permission.upsert({
      where: { name: 'company.create' },
      update: {},
      create: { name: 'company.create', description: 'Create company' },
    });
    const auditReadPerm = await prisma.permission.upsert({
      where: { name: 'audit.read' },
      update: {},
      create: { name: 'audit.read', description: 'Read audit logs' },
    });

    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
    const userRole = await prisma.role.findUniqueOrThrow({ where: { name: 'USER' } });

    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: companyDeletePerm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: companyDeletePerm.id },
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: auditReadPerm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: auditReadPerm.id },
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: userRole.id, permissionId: companyCreatePerm.id } },
      update: {},
      create: { roleId: userRole.id, permissionId: companyCreatePerm.id },
    });

    // 1. Register Regular User
    const userRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'regular-user@example.com',
        password: 'Password123!',
        fullName: 'Regular User',
      });
    regularUserToken = userRes.body.accessToken;
    regularUserId = userRes.body.user.id;

    // 2. Register Admin User and assign ADMIN role
    const adminRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'admin-user@example.com',
        password: 'Password123!',
        fullName: 'Admin User',
      });
    adminUserToken = adminRes.body.accessToken;
    adminUserId = adminRes.body.user.id;

    await rbacService.assignRole(adminUserId, 'ADMIN');

    // Create a company for delete testing
    const company = await prisma.company.create({
      data: { name: 'RBAC Target Corp', industry: 'Tech' },
    });
    companyId = company.id;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('Unauthorized Access (401)', () => {
    it('GET /api/v1/rbac/roles should return 401 without bearer token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/rbac/roles')
        .expect(401);
    });

    it('DELETE /api/v1/companies/:id should return 401 without bearer token', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/companies/${companyId}`)
        .expect(401);
    });
  });

  describe('Forbidden Access (403)', () => {
    it('GET /api/v1/rbac/roles should return 403 for standard USER', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/rbac/roles')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });

    it('GET /api/v1/audit-logs should return 403 for standard USER', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });

    it('DELETE /api/v1/companies/:id should return 403 for standard USER', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/companies/${companyId}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('Admin Access (200 / 204)', () => {
    it('GET /api/v1/rbac/roles should return 200 for ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/rbac/roles')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((r: any) => r.name === 'ADMIN')).toBe(true);
    });

    it('GET /api/v1/audit-logs should return 200 for ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
    });

    it('DELETE /api/v1/companies/:id should succeed with 204 for ADMIN', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/companies/${companyId}`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .expect(204);
    });
  });

  describe('Permission Cache & Dynamic Invalidation', () => {
    it('should dynamically update permissions when role is assigned and cache is invalidated', async () => {
      // 1. Initially regularUser cannot access audit-logs (403)
      await request(app.getHttpServer())
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);

      // 2. Dynamically assign ADMIN role to regularUser
      await rbacService.assignRole(regularUserId, 'ADMIN');

      // 3. Now regularUser CAN access audit-logs (200) due to cache invalidation
      await request(app.getHttpServer())
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(200);

      // 4. Revoke ADMIN role
      await rbacService.removeRole(regularUserId, 'ADMIN');

      // 5. Access should immediately be revoked (403)
      await request(app.getHttpServer())
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });
});
