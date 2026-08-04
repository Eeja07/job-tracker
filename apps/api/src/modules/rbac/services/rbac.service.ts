import { Injectable, Logger, Optional } from '@nestjs/common';
import { RoleRepository } from '../../../repositories/role/role.repository';
import { PermissionRepository } from '../../../repositories/permission/permission.repository';
import { UserRoleRepository } from '../../../repositories/user-role/user-role.repository';
import { RolePermissionRepository } from '../../../repositories/role-permission/role-permission.repository';
import { RedisService } from '../../redis/redis.service';
import { MetricsService } from '../../../core/metrics/metrics.service';

const PERMISSIONS_CACHE_TTL = 300; // 5 minutes

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

  // ─── Cache Helpers ────────────────────────────────────────────────────────

  private permissionsCacheKey(userId: string): string {
    return `permissions:user:${userId}`;
  }

  private async invalidateCache(userId: string): Promise<void> {
    if (this.redisService) {
      await this.redisService.del(this.permissionsCacheKey(userId));
      this.logger.debug(`RBAC cache invalidated for user ${userId}`);
    }
  }

  // ─── Role Management ──────────────────────────────────────────────────────

  async assignRole(userId: string, roleName: string): Promise<void> {
    const role = await this.roleRepository.findByName(roleName);
    if (!role) {
      throw new Error(`Role '${roleName}' not found`);
    }
    await this.userRoleRepository.assign(userId, role.id);
    await this.invalidateCache(userId);
    this.logger.log(`Role '${roleName}' assigned to user ${userId}`);
  }

  async removeRole(userId: string, roleName: string): Promise<void> {
    const role = await this.roleRepository.findByName(roleName);
    if (!role) {
      throw new Error(`Role '${roleName}' not found`);
    }
    await this.userRoleRepository.remove(userId, role.id);
    await this.invalidateCache(userId);
    this.logger.log(`Role '${roleName}' removed from user ${userId}`);
  }

  async hasRole(userId: string, roleName: string): Promise<boolean> {
    const roleNames = await this.getRoles(userId);
    return roleNames.includes(roleName);
  }

  async getRoles(userId: string): Promise<string[]> {
    return this.userRoleRepository.getRoleNamesForUser(userId);
  }

  // ─── Permission Management ────────────────────────────────────────────────

  async getPermissions(userId: string): Promise<string[]> {
    // 1. Try Redis cache
    if (this.redisService) {
      try {
        const cached = await this.redisService.get(this.permissionsCacheKey(userId));
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
        this.logger.warn(`RBAC Redis cache read failed: ${err.message}. Falling back to DB.`);
      }
    }

    this.metricsService?.rbacCacheMissesTotal.inc({ userId });

    // 2. Fetch from DB
    const permissions = await this.rolePermissionRepository.getPermissionNamesForUser(userId);

    // 3. Write to cache
    if (this.redisService) {
      try {
        await this.redisService.set(
          this.permissionsCacheKey(userId),
          JSON.stringify(permissions),
          PERMISSIONS_CACHE_TTL,
        );
      } catch (err: any) {
        this.logger.warn(`RBAC Redis cache write failed: ${err.message}`);
      }
    }

    return permissions;
  }

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getPermissions(userId);
    return permissions.includes(permission);
  }

  async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getPermissions(userId);
    return permissions.some((p) => userPermissions.includes(p));
  }

  async hasAllPermissions(userId: string, permissions: string[]): Promise<boolean> {
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
