import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { RbacService } from '../services/rbac.service';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;
  let rbacService: jest.Mocked<RbacService>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    rbacService = {
      hasRole: jest.fn(),
    } as any;

    guard = new RolesGuard(reflector, rbacService);
  });

  const createMockContext = (user?: any): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as any;

  it('should allow access if no roles are required', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createMockContext({ sub: 'user-123' });

    const res = await guard.canActivate(context);
    expect(res).toBe(true);
  });

  it('should allow access if user has required role', async () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    rbacService.hasRole.mockResolvedValue(true);
    const context = createMockContext({ sub: 'user-123' });

    const res = await guard.canActivate(context);
    expect(res).toBe(true);
    expect(rbacService.hasRole).toHaveBeenCalledWith('user-123', 'ADMIN');
  });

  it('should throw ForbiddenException if user lacks required role', async () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    rbacService.hasRole.mockResolvedValue(false);
    const context = createMockContext({ sub: 'user-123' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if context has no user', async () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    const context = createMockContext(undefined);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should throw InternalServerErrorException if RbacService is unavailable (fail-closed)', async () => {
    const unconfiguredGuard = new RolesGuard(reflector, undefined);
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    const context = createMockContext({ sub: 'user-123' });

    await expect(unconfiguredGuard.canActivate(context)).rejects.toThrow(
      'Authorization provider unavailable',
    );
  });
});
