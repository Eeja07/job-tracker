import { Test, TestingModule } from '@nestjs/testing';
import { RbacService } from './rbac.service';
import { RoleRepository } from '../../../repositories/role/role.repository';
import { PermissionRepository } from '../../../repositories/permission/permission.repository';
import { UserRoleRepository } from '../../../repositories/user-role/user-role.repository';
import { RolePermissionRepository } from '../../../repositories/role-permission/role-permission.repository';
import { RedisService } from '../../redis/redis.service';

describe('RbacService', () => {
  let service: RbacService;
  let roleRepo: jest.Mocked<RoleRepository>;
  let userRoleRepo: jest.Mocked<UserRoleRepository>;
  let rolePermRepo: jest.Mocked<RolePermissionRepository>;
  let redisService: jest.Mocked<RedisService>;

  const mockRole = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'ADMIN',
    description: 'Admin role',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacService,
        {
          provide: RoleRepository,
          useValue: {
            findByName: jest.fn(),
            findAll: jest.fn(),
          },
        },
        {
          provide: PermissionRepository,
          useValue: {
            findByName: jest.fn(),
            findAll: jest.fn(),
          },
        },
        {
          provide: UserRoleRepository,
          useValue: {
            assign: jest.fn(),
            remove: jest.fn(),
            getRoleNamesForUser: jest.fn(),
          },
        },
        {
          provide: RolePermissionRepository,
          useValue: {
            getPermissionNamesForUser: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RbacService>(RbacService);
    roleRepo = module.get(RoleRepository);
    userRoleRepo = module.get(UserRoleRepository);
    rolePermRepo = module.get(RolePermissionRepository);
    redisService = module.get(RedisService);
  });

  describe('assignRole', () => {
    it('should assign role and invalidate cache (pre & post DB write)', async () => {
      roleRepo.findByName.mockResolvedValue(mockRole);
      userRoleRepo.assign.mockResolvedValue({} as any);

      await service.assignRole('user-123', 'ADMIN');

      expect(roleRepo.findByName).toHaveBeenCalledWith('ADMIN', undefined);
      expect(userRoleRepo.assign).toHaveBeenCalledWith(
        'user-123',
        mockRole.id,
        undefined,
      );
      expect(redisService.del).toHaveBeenCalledWith(
        'permissions:user:user-123',
      );
      expect(redisService.del).toHaveBeenCalledWith('roles:user:user-123');
    });

    it('should throw error if role does not exist', async () => {
      roleRepo.findByName.mockResolvedValue(null);

      await expect(
        service.assignRole('user-123', 'NONEXISTENT'),
      ).rejects.toThrow("Role 'NONEXISTENT' not found");
    });
  });

  describe('removeRole', () => {
    it('should remove role and invalidate cache (pre & post DB write)', async () => {
      roleRepo.findByName.mockResolvedValue(mockRole);
      userRoleRepo.remove.mockResolvedValue(undefined);

      await service.removeRole('user-123', 'ADMIN');

      expect(roleRepo.findByName).toHaveBeenCalledWith('ADMIN', undefined);
      expect(userRoleRepo.remove).toHaveBeenCalledWith(
        'user-123',
        mockRole.id,
        undefined,
      );
      expect(redisService.del).toHaveBeenCalledWith(
        'permissions:user:user-123',
      );
      expect(redisService.del).toHaveBeenCalledWith('roles:user:user-123');
    });
  });

  describe('getPermissions', () => {
    it('should return cached permissions on Redis hit', async () => {
      redisService.get.mockResolvedValue(
        JSON.stringify(['company.create', 'company.delete']),
      );

      const perms = await service.getPermissions('user-123');

      expect(perms).toEqual(['company.create', 'company.delete']);
      expect(rolePermRepo.getPermissionNamesForUser).not.toHaveBeenCalled();
    });

    it('should query DB and populate Redis cache on cache miss', async () => {
      redisService.get.mockResolvedValue(null);
      rolePermRepo.getPermissionNamesForUser.mockResolvedValue([
        'company.create',
      ]);

      const perms = await service.getPermissions('user-123');

      expect(perms).toEqual(['company.create']);
      expect(rolePermRepo.getPermissionNamesForUser).toHaveBeenCalledWith(
        'user-123',
      );
      expect(redisService.set).toHaveBeenCalledWith(
        'permissions:user:user-123',
        JSON.stringify(['company.create']),
        300,
      );
    });

    it('should fallback to DB gracefully when Redis throws an error', async () => {
      redisService.get.mockRejectedValue(new Error('Redis connection failed'));
      rolePermRepo.getPermissionNamesForUser.mockResolvedValue([
        'company.read',
      ]);

      const perms = await service.getPermissions('user-123');

      expect(perms).toEqual(['company.read']);
      expect(rolePermRepo.getPermissionNamesForUser).toHaveBeenCalledWith(
        'user-123',
      );
    });
  });

  describe('getRoles', () => {
    it('should return cached roles on Redis hit', async () => {
      redisService.get.mockResolvedValue(JSON.stringify(['ADMIN']));

      const roles = await service.getRoles('user-123');

      expect(roles).toEqual(['ADMIN']);
      expect(userRoleRepo.getRoleNamesForUser).not.toHaveBeenCalled();
    });

    it('should query DB and populate cache on Redis miss', async () => {
      redisService.get.mockResolvedValue(null);
      userRoleRepo.getRoleNamesForUser.mockResolvedValue(['USER']);

      const roles = await service.getRoles('user-123');

      expect(roles).toEqual(['USER']);
      expect(userRoleRepo.getRoleNamesForUser).toHaveBeenCalledWith('user-123');
      expect(redisService.set).toHaveBeenCalledWith(
        'roles:user:user-123',
        JSON.stringify(['USER']),
        300,
      );
    });
  });

  describe('hasPermission', () => {
    it('should return true if user has permission', async () => {
      redisService.get.mockResolvedValue(JSON.stringify(['company.create']));

      const result = await service.hasPermission('user-123', 'company.create');
      expect(result).toBe(true);
    });

    it('should return false if user does not have permission', async () => {
      redisService.get.mockResolvedValue(JSON.stringify(['company.create']));

      const result = await service.hasPermission('user-123', 'company.delete');
      expect(result).toBe(false);
    });
  });

  describe('concurrent operations', () => {
    it('should execute concurrent permission checks cleanly', async () => {
      redisService.get.mockResolvedValue(
        JSON.stringify(['company.create', 'company.read']),
      );

      const [res1, res2, res3] = await Promise.all([
        service.hasPermission('user-123', 'company.create'),
        service.hasAnyPermission('user-123', ['company.read']),
        service.hasAllPermissions('user-123', [
          'company.create',
          'company.read',
        ]),
      ]);

      expect(res1).toBe(true);
      expect(res2).toBe(true);
      expect(res3).toBe(true);
    });
  });
});
