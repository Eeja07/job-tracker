import { Test, TestingModule } from '@nestjs/testing';
import { RbacController } from './rbac.controller';
import { RbacService } from './services/rbac.service';

describe('RbacController', () => {
  let controller: RbacController;
  let rbacService: jest.Mocked<RbacService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RbacController],
      providers: [
        {
          provide: RbacService,
          useValue: {
            getAllRoles: jest.fn(),
            getAllPermissions: jest.fn(),
            getRoles: jest.fn(),
            getPermissions: jest.fn(),
            assignRole: jest.fn(),
            removeRole: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RbacController>(RbacController);
    rbacService = module.get(RbacService);
  });

  it('should list all roles', async () => {
    rbacService.getAllRoles.mockResolvedValue([{ id: '1', name: 'ADMIN' }] as any);
    const roles = await controller.getAllRoles();
    expect(roles).toEqual([{ id: '1', name: 'ADMIN' }]);
  });

  it('should list all permissions', async () => {
    rbacService.getAllPermissions.mockResolvedValue([{ id: '1', name: 'company.create' }] as any);
    const perms = await controller.getAllPermissions();
    expect(perms).toEqual([{ id: '1', name: 'company.create' }]);
  });

  it('should assign a role to a user', async () => {
    rbacService.assignRole.mockResolvedValue(undefined);
    const res = await controller.assignRole('11111111-1111-1111-1111-111111111111', { roleName: 'ADMIN' });
    expect(res).toEqual({ message: "Role 'ADMIN' assigned to user 11111111-1111-1111-1111-111111111111" });
    expect(rbacService.assignRole).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', 'ADMIN');
  });

  it('should remove a role from a user', async () => {
    rbacService.removeRole.mockResolvedValue(undefined);
    await controller.removeRole('11111111-1111-1111-1111-111111111111', 'USER');
    expect(rbacService.removeRole).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', 'USER');
  });
});
