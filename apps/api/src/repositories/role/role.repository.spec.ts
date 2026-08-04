import { Test, TestingModule } from '@nestjs/testing';
import { RoleRepository } from './role.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('RoleRepository', () => {
  let repository: RoleRepository;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      role: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get<RoleRepository>(RoleRepository);
  });

  it('should find role by name', async () => {
    const mockRole = { id: '1', name: 'ADMIN' };
    prisma.role.findUnique.mockResolvedValue(mockRole);

    const result = await repository.findByName('ADMIN');
    expect(result).toEqual(mockRole);
    expect(prisma.role.findUnique).toHaveBeenCalledWith({ where: { name: 'ADMIN' } });
  });

  it('should find all roles', async () => {
    const mockRoles = [{ id: '1', name: 'ADMIN' }, { id: '2', name: 'USER' }];
    prisma.role.findMany.mockResolvedValue(mockRoles);

    const result = await repository.findAll();
    expect(result).toEqual(mockRoles);
  });
});
