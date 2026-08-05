import { Test, TestingModule } from '@nestjs/testing';
import { User, Prisma } from '@prisma/client';
import {
  UserRepository,
  CreateUserData,
  UpdateUserData,
} from './user.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('UserRepository', () => {
  let repository: UserRepository;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUser: User = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    passwordHash: 'hashed-pwd',
    fullName: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
    isEmailVerified: true,
    lastLoginAt: new Date('2026-08-01T00:00:00Z'),
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
  };

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRepository,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    repository = module.get<UserRepository>(UserRepository);
    prismaService = module.get(PrismaService);
  });

  describe('findById', () => {
    it('should return user when found by ID', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await repository.findById('user-uuid-1');

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user is not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should use transaction client if provided', async () => {
      const mockTx = {
        user: {
          findUnique: jest.fn().mockResolvedValue(mockUser),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await repository.findById('user-uuid-1', mockTx);

      expect(mockTx.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
      });
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });
  });

  describe('findByEmail', () => {
    it('should return user when found by email', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await repository.findByEmail('test@example.com');

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should use transaction client if provided', async () => {
      const mockTx = {
        user: {
          findUnique: jest.fn().mockResolvedValue(mockUser),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await repository.findByEmail('test@example.com', mockTx);

      expect(mockTx.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('create', () => {
    it('should create and return a new user', async () => {
      const createData: CreateUserData = {
        email: 'test@example.com',
        passwordHash: 'hashed-pwd',
        fullName: 'Test User',
      };

      (prismaService.user.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await repository.create(createData);

      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: createData,
      });
      expect(result).toEqual(mockUser);
    });

    it('should propagate database errors', async () => {
      const createData: CreateUserData = {
        email: 'duplicate@example.com',
        passwordHash: 'hashed-pwd',
        fullName: 'Duplicate User',
      };

      (prismaService.user.create as jest.Mock).mockRejectedValue(
        new Error('Unique constraint violation'),
      );

      await expect(repository.create(createData)).rejects.toThrow(
        'Unique constraint violation',
      );
    });
  });

  describe('update', () => {
    it('should update user fields and return updated user', async () => {
      const updateData: UpdateUserData = {
        fullName: 'Updated Name',
      };
      const updatedUser = { ...mockUser, fullName: 'Updated Name' };

      (prismaService.user.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await repository.update('user-uuid-1', updateData);

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: updateData,
      });
      expect(result).toEqual(updatedUser);
    });
  });

  describe('delete', () => {
    it('should delete and return deleted user', async () => {
      (prismaService.user.delete as jest.Mock).mockResolvedValue(mockUser);

      const result = await repository.delete('user-uuid-1');

      expect(prismaService.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
      });
      expect(result).toEqual(mockUser);
    });
  });
});
