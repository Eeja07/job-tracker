import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';
import { RbacService } from '../services/rbac.service';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: jest.Mocked<Reflector>;
  let rbacService: jest.Mocked<RbacService>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    rbacService = {
      hasAnyPermission: jest.fn(),
    } as any;

    guard = new PermissionsGuard(reflector, rbacService);
  });

  const createMockContext = (user?: any): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as any;

  it('should allow access if no permissions are required', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createMockContext({ sub: 'user-123' });

    const res = await guard.canActivate(context);
    expect(res).toBe(true);
  });

  it('should allow access if user has required permission', async () => {
    reflector.getAllAndOverride.mockReturnValue(['company.create']);
    rbacService.hasAnyPermission.mockResolvedValue(true);
    const context = createMockContext({ sub: 'user-123' });

    const res = await guard.canActivate(context);
    expect(res).toBe(true);
    expect(rbacService.hasAnyPermission).toHaveBeenCalledWith('user-123', [
      'company.create',
    ]);
  });

  it('should throw ForbiddenException if user lacks required permission', async () => {
    reflector.getAllAndOverride.mockReturnValue(['company.delete']);
    rbacService.hasAnyPermission.mockResolvedValue(false);
    const context = createMockContext({ sub: 'user-123' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should throw InternalServerErrorException if RbacService is unavailable (fail-closed)', async () => {
    const unconfiguredGuard = new PermissionsGuard(reflector, undefined);
    reflector.getAllAndOverride.mockReturnValue(['company.delete']);
    const context = createMockContext({ sub: 'user-123' });

    await expect(unconfiguredGuard.canActivate(context)).rejects.toThrow(
      'Authorization provider unavailable',
    );
  });
});
