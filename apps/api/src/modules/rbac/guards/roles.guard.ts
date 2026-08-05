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
import { ROLES_KEY } from '../decorators/rbac.decorators';
import { RbacService } from '../services/rbac.service';
import { MetricsService } from '../../../core/metrics/metrics.service';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly rbacService?: RbacService,
    @Optional() private readonly metricsService?: MetricsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
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
        'RbacService is not available in RolesGuard. Security fail-closed triggered.',
      );
      throw new InternalServerErrorException(
        'Authorization provider unavailable',
      );
    }

    for (const role of requiredRoles) {
      const has = await this.rbacService.hasRole(userId, role);
      if (has) {
        this.logger.debug(`User ${userId} granted via role '${role}'`);
        return true;
      }
    }

    this.logger.warn(
      `User ${userId} denied: requires one of roles [${requiredRoles.join(', ')}]`,
    );
    this.metricsService?.rbacPermissionDeniedTotal.inc({ type: 'role' });
    throw new ForbiddenException(
      `Access denied: requires role [${requiredRoles.join(' | ')}]`,
    );
  }
}
