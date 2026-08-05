import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanDatabase, TestAppSetup } from './test-utils';
import { PrismaService } from '../src/prisma/prisma.service';
import { FeatureFlagService } from '../src/modules/feature-flags/services/feature-flag.service';
import { RedisService } from '../src/modules/redis/redis.service';

describe('Feature Flags Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let setup: TestAppSetup;
  let featureFlagService: FeatureFlagService;
  let redisService: RedisService;

  let adminToken: string;
  let regularToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    setup = await createTestApp();
    app = setup.app;
    prisma = setup.prisma;
    featureFlagService = app.get(FeatureFlagService);
    redisService = app.get(RedisService);
    await cleanDatabase(prisma);

    // Register Admin User
    const adminRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'admin-ff@example.com',
        password: 'Password123!',
        fullName: 'Admin FF User',
      });
    adminToken = adminRes.body.accessToken;
    adminUserId = adminRes.body.user.id;

    // Assign ADMIN role to admin user
    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { name: 'ADMIN' },
    });
    await prisma.userRole.create({
      data: {
        userId: adminUserId,
        roleId: adminRole.id,
      },
    });

    // Register Regular User
    const userRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'user-ff@example.com',
        password: 'Password123!',
        fullName: 'Regular FF User',
      });
    regularToken = userRes.body.accessToken;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('Feature Flag Management Endpoints (CRUD)', () => {
    it('POST /api/v1/feature-flags - Admin should create a new feature flag', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'NEW_ANALYTICS_DASHBOARD',
          description: 'Enable revamped analytics dashboard',
          enabled: true,
          rolloutPercentage: 100,
        })
        .expect(201);

      expect(res.body.key).toBe('NEW_ANALYTICS_DASHBOARD');
      expect(res.body.enabled).toBe(true);
      expect(res.body.rolloutPercentage).toBe(100);
    });

    it('GET /api/v1/feature-flags - Should list all feature flags', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/feature-flags/:key - Should retrieve specific feature flag', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/feature-flags/NEW_ANALYTICS_DASHBOARD')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.key).toBe('NEW_ANALYTICS_DASHBOARD');
    });

    it('PATCH /api/v1/feature-flags/:key/enable - Admin should toggle enabled status', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/feature-flags/NEW_ANALYTICS_DASHBOARD/enable')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: false })
        .expect(200);

      expect(res.body.enabled).toBe(false);
    });

    it('PATCH /api/v1/feature-flags/:key/rollout - Admin should update rollout percentage', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/feature-flags/NEW_ANALYTICS_DASHBOARD/rollout')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rolloutPercentage: 50 })
        .expect(200);

      expect(res.body.rolloutPercentage).toBe(50);
    });

    it('POST /api/v1/feature-flags/refresh - Admin should refresh Redis cache', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/feature-flags/refresh')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.message).toContain('refreshed');
    });
  });

  describe('Feature Flag Evaluation & Behavior', () => {
    it('Feature Enabled: isEnabled should return true for 100% rollout', async () => {
      await featureFlagService.create({
        key: 'ENABLED_FEATURE',
        enabled: true,
        rolloutPercentage: 100,
      });

      const isEnabled = await featureFlagService.isEnabled(
        'ENABLED_FEATURE',
        adminUserId,
      );
      expect(isEnabled).toBe(true);
    });

    it('Feature Disabled: isEnabled should return false', async () => {
      await featureFlagService.create({
        key: 'DISABLED_FEATURE',
        enabled: false,
        rolloutPercentage: 100,
      });

      const isEnabled = await featureFlagService.isEnabled(
        'DISABLED_FEATURE',
        adminUserId,
      );
      expect(isEnabled).toBe(false);
    });

    it('Percentage Rollout: Consistent rollout hashing per userId', async () => {
      await featureFlagService.create({
        key: 'PERCENTAGE_FEATURE',
        enabled: true,
        rolloutPercentage: 50,
      });

      const result1a = await featureFlagService.isEnabled(
        'PERCENTAGE_FEATURE',
        'user-id-alpha',
      );
      const result1b = await featureFlagService.isEnabled(
        'PERCENTAGE_FEATURE',
        'user-id-alpha',
      );

      // Hash consistency: same user always receives identical evaluation result
      expect(result1a).toBe(result1b);

      const result2a = await featureFlagService.isEnabled(
        'PERCENTAGE_FEATURE',
        'user-id-beta',
      );
      const result2b = await featureFlagService.isEnabled(
        'PERCENTAGE_FEATURE',
        'user-id-beta',
      );
      expect(result2a).toBe(result2b);
    });

    it('Cache Invalidation: Updating feature flag invalidates old cache value', async () => {
      await featureFlagService.create({
        key: 'CACHE_TEST_FLAG',
        enabled: true,
        rolloutPercentage: 100,
      });

      // Warm cache
      const initial = await featureFlagService.get('CACHE_TEST_FLAG');
      expect(initial?.enabled).toBe(true);

      // Mutate flag status via setEnabled
      await featureFlagService.setEnabled('CACHE_TEST_FLAG', false);

      // Re-fetch must yield updated value immediately (bypassing stale cache)
      const reFetched = await featureFlagService.get('CACHE_TEST_FLAG');
      expect(reFetched?.enabled).toBe(false);
    });
  });

  describe('Clean Up', () => {
    it('DELETE /api/v1/feature-flags/:key - Admin should delete feature flag', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/feature-flags/NEW_ANALYTICS_DASHBOARD')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      const flag = await prisma.featureFlag.findUnique({
        where: { key: 'NEW_ANALYTICS_DASHBOARD' },
      });
      expect(flag).toBeNull();
    });
  });
});
