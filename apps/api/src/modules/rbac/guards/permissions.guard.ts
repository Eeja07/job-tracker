import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/rbac.decorators';
import { RbacService } from '../services/rbac.service';
import { MetricsService } from '../../../core/metrics/metrics.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly rbacService?: RbacService,
    @Optional() private readonly metricsService?: MetricsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.sub) {
      throw new ForbiddenException('Access denied: no authenticated user');
    }

    const userId = user.sub as string;

    if (!this.rbacService) {
      this.logger.error(
        'RbacService is not available in PermissionsGuard. Security fail-closed triggered.',
      );
      throw new InternalServerErrorException(
        'Authorization provider unavailable',
      );
    }

    this.metricsService?.rbacPermissionChecksTotal.inc({
      permission: requiredPermissions.join(','),
    });

    const allowed = await this.rbacService.hasAnyPermission(
      userId,
      requiredPermissions,
    );

    if (!allowed) {
      this.logger.warn(
        `User ${userId} denied: requires permission [${requiredPermissions.join(', ')}]`,
      );
      this.metricsService?.rbacPermissionDeniedTotal.inc({
        type: 'permission',
      });
      throw new ForbiddenException(
        `Access denied: requires permission [${requiredPermissions.join(' | ')}]`,
      );
    }

    this.logger.debug(`User ${userId} granted via permission check`);
    return true;
  }
}
