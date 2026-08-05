import { Test, TestingModule } from '@nestjs/testing';
import { FeatureFlagRepository } from './feature-flag.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('FeatureFlagRepository', () => {
  let repository: FeatureFlagRepository;
  let prisma: PrismaService;

  const mockPrismaService = {
    featureFlag: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    repository = module.get<FeatureFlagRepository>(FeatureFlagRepository);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findByKey', () => {
    it('should call prisma.featureFlag.findUnique with key', async () => {
      const mockFlag = {
        id: 'uuid-1',
        key: 'test_flag',
        enabled: true,
        rolloutPercentage: 100,
      };
      mockPrismaService.featureFlag.findUnique.mockResolvedValue(mockFlag);

      const result = await repository.findByKey('test_flag');
      expect(prisma.featureFlag.findUnique).toHaveBeenCalledWith({
        where: { key: 'test_flag' },
      });
      expect(result).toEqual(mockFlag);
    });
  });

  describe('findAll', () => {
    it('should return all feature flags ordered by key', async () => {
      const mockFlags = [
        { id: 'uuid-1', key: 'flag1' },
        { id: 'uuid-2', key: 'flag2' },
      ];
      mockPrismaService.featureFlag.findMany.mockResolvedValue(mockFlags);

      const result = await repository.findAll();
      expect(prisma.featureFlag.findMany).toHaveBeenCalledWith({
        orderBy: { key: 'asc' },
      });
      expect(result).toEqual(mockFlags);
    });
  });

  describe('create', () => {
    it('should create a new feature flag', async () => {
      const dto = {
        key: 'new_flag',
        description: 'Test',
        enabled: true,
        rolloutPercentage: 50,
      };
      mockPrismaService.featureFlag.create.mockResolvedValue({
        id: 'uuid-1',
        ...dto,
      });

      const result = await repository.create(dto);
      expect(prisma.featureFlag.create).toHaveBeenCalledWith({
        data: {
          key: 'new_flag',
          description: 'Test',
          enabled: true,
          rolloutPercentage: 50,
        },
      });
      expect(result.key).toBe('new_flag');
    });
  });

  describe('update', () => {
    it('should update feature flag fields', async () => {
      mockPrismaService.featureFlag.update.mockResolvedValue({
        key: 'test_flag',
        enabled: false,
      });

      const result = await repository.update('test_flag', { enabled: false });
      expect(prisma.featureFlag.update).toHaveBeenCalledWith({
        where: { key: 'test_flag' },
        data: { enabled: false },
      });
      expect(result.enabled).toBe(false);
    });
  });

  describe('upsert', () => {
    it('should upsert feature flag', async () => {
      mockPrismaService.featureFlag.upsert.mockResolvedValue({
        key: 'test_flag',
        enabled: true,
      });

      const result = await repository.upsert('test_flag', {
        key: 'test_flag',
        enabled: true,
        rolloutPercentage: 100,
      });
      expect(prisma.featureFlag.upsert).toHaveBeenCalledWith({
        where: { key: 'test_flag' },
        update: { enabled: true, rolloutPercentage: 100 },
        create: {
          key: 'test_flag',
          description: null,
          enabled: true,
          rolloutPercentage: 100,
        },
      });
      expect(result.enabled).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete feature flag', async () => {
      mockPrismaService.featureFlag.delete.mockResolvedValue({
        key: 'test_flag',
      });

      const result = await repository.delete('test_flag');
      expect(prisma.featureFlag.delete).toHaveBeenCalledWith({
        where: { key: 'test_flag' },
      });
      expect(result.key).toBe('test_flag');
    });
  });
});
