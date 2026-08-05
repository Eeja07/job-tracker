import {
  Injectable,
  Logger,
  Optional,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RoleRepository } from '../../../repositories/role/role.repository';
import { PermissionRepository } from '../../../repositories/permission/permission.repository';
import { UserRoleRepository } from '../../../repositories/user-role/user-role.repository';
import { RolePermissionRepository } from '../../../repositories/role-permission/role-permission.repository';
import { RedisService } from '../../redis/redis.service';
import { MetricsService } from '../../../core/metrics/metrics.service';

const CACHE_TTL = 300; // 5 minutes

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(
    private readonly roleRepository: RoleRepository,
    private readonly permissionRepository: PermissionRepository,
    private readonly userRoleRepository: UserRoleRepository,
    private readonly rolePermissionRepository: RolePermissionRepository,
    @Optional() private readonly redisService?: RedisService,
    @Optional() private readonly metricsService?: MetricsService,
  ) {}

  // ─── Cache Key Builders & Helpers ─────────────────────────────────────────

  private permissionsCacheKey(userId: string): string {
    return `permissions:user:${userId}`;
  }

  private rolesCacheKey(userId: string): string {
    return `roles:user:${userId}`;
  }

  async invalidateUserCache(userId: string): Promise<void> {
    if (this.redisService) {
      try {
        await Promise.all([
          this.redisService.del(this.permissionsCacheKey(userId)),
          this.redisService.del(this.rolesCacheKey(userId)),
        ]);
        this.logger.debug(`RBAC cache invalidated for user ${userId}`);
      } catch (err: any) {
        this.logger.warn(
          `RBAC cache invalidation error for user ${userId}: ${err.message}`,
        );
      }
    }
  }

  // ─── Role Management ──────────────────────────────────────────────────────

  async assignRole(
    userId: string,
    roleName: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const role = await this.roleRepository.findByName(roleName, tx);
    if (!role) {
      throw new Error(`Role '${roleName}' not found`);
    }

    // Double Invalidation Pattern (pre & post DB write to eliminate race condition window)
    await this.invalidateUserCache(userId);
    await this.userRoleRepository.assign(userId, role.id, tx);
    await this.invalidateUserCache(userId);

    this.logger.log(`Role '${roleName}' assigned to user ${userId}`);
  }

  async removeRole(
    userId: string,
    roleName: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const role = await this.roleRepository.findByName(roleName, tx);
    if (!role) {
      throw new NotFoundException(`Role '${roleName}' not found`);
    }

    // Double Invalidation Pattern
    await this.invalidateUserCache(userId);
    await this.userRoleRepository.remove(userId, role.id, tx);
    await this.invalidateUserCache(userId);

    this.logger.log(`Role '${roleName}' removed from user ${userId}`);
  }

  async hasRole(userId: string, roleName: string): Promise<boolean> {
    const roleNames = await this.getRoles(userId);
    return roleNames.includes(roleName);
  }

  async getRoles(userId: string): Promise<string[]> {
    // 1. Try Redis cache
    if (this.redisService) {
      try {
        const cached = await this.redisService.get(this.rolesCacheKey(userId));
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as string[];
            this.metricsService?.rbacCacheHitsTotal.inc({ userId });
            return parsed;
          } catch {
            // ignore and re-fetch
          }
        }
      } catch (err: any) {
        this.logger.warn(
          `RBAC Redis roles cache read failed: ${err.message}. Falling back to DB.`,
        );
      }
    }

    this.metricsService?.rbacCacheMissesTotal.inc({ userId });

    // 2. Fetch from DB
    const roles = await this.userRoleRepository.getRoleNamesForUser(userId);

    // 3. Write to cache
    if (this.redisService) {
      try {
        await this.redisService.set(
          this.rolesCacheKey(userId),
          JSON.stringify(roles),
          CACHE_TTL,
        );
      } catch (err: any) {
        this.logger.warn(`RBAC Redis roles cache write failed: ${err.message}`);
      }
    }

    return roles;
  }

  // ─── Permission Management ────────────────────────────────────────────────

  async getPermissions(userId: string): Promise<string[]> {
    // 1. Try Redis cache
    if (this.redisService) {
      try {
        const cached = await this.redisService.get(
          this.permissionsCacheKey(userId),
        );
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as string[];
            this.metricsService?.rbacCacheHitsTotal.inc({ userId });
            return parsed;
          } catch {
            // ignore and re-fetch from DB
          }
        }
      } catch (err: any) {
        this.logger.warn(
          `RBAC Redis permissions cache read failed: ${err.message}. Falling back to DB.`,
        );
      }
    }

    this.metricsService?.rbacCacheMissesTotal.inc({ userId });

    // 2. Fetch from DB
    const permissions =
      await this.rolePermissionRepository.getPermissionNamesForUser(userId);

    // 3. Write to cache
    if (this.redisService) {
      try {
        await this.redisService.set(
          this.permissionsCacheKey(userId),
          JSON.stringify(permissions),
          CACHE_TTL,
        );
      } catch (err: any) {
        this.logger.warn(
          `RBAC Redis permissions cache write failed: ${err.message}`,
        );
      }
    }

    return permissions;
  }

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getPermissions(userId);
    return permissions.includes(permission);
  }

  async hasAnyPermission(
    userId: string,
    permissions: string[],
  ): Promise<boolean> {
    const userPermissions = await this.getPermissions(userId);
    return permissions.some((p) => userPermissions.includes(p));
  }

  async hasAllPermissions(
    userId: string,
    permissions: string[],
  ): Promise<boolean> {
    const userPermissions = await this.getPermissions(userId);
    return permissions.every((p) => userPermissions.includes(p));
  }

  // ─── Admin Utilities ──────────────────────────────────────────────────────

  async getAllRoles() {
    return this.roleRepository.findAll();
  }

  async getAllPermissions() {
    return this.permissionRepository.findAll();
  }
}
