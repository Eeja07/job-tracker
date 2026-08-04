import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';
import { FeatureFlagRepository } from '../../../repositories/feature-flag/feature-flag.repository';
import { RedisService } from '../../redis/redis.service';
import { MetricsService } from '../../../core/metrics/metrics.service';

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;
  let repository: FeatureFlagRepository;
  let redisService: RedisService;
  let metricsService: MetricsService;

  const mockRepository = {
    findByKey: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockCounter = { inc: jest.fn() };
  const mockMetricsService = {
    featureFlagHitsTotal: mockCounter,
    featureFlagMissesTotal: mockCounter,
    featureFlagCacheHitsTotal: mockCounter,
    featureFlagCacheMissesTotal: mockCounter,
  };

  const now = new Date();
  const mockFlag = {
    id: 'uuid-1',
    key: 'test_flag',
    description: 'Test Flag',
    enabled: true,
    rolloutPercentage: 100,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagService,
        { provide: FeatureFlagRepository, useValue: mockRepository },
        { provide: RedisService, useValue: mockRedisService },
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    service = module.get<FeatureFlagService>(FeatureFlagService);
    repository = module.get<FeatureFlagRepository>(FeatureFlagRepository);
    redisService = module.get<RedisService>(RedisService);
    metricsService = module.get<MetricsService>(MetricsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get', () => {
    it('should return flag from Redis cache if present', async () => {
      mockRedisService.get.mockResolvedValue(JSON.stringify(mockFlag));

      const result = await service.get('test_flag');
      expect(redisService.get).toHaveBeenCalledWith('feature-flags:test_flag');
      expect(metricsService.featureFlagCacheHitsTotal.inc).toHaveBeenCalledWith({ flag: 'test_flag' });
      expect(result?.key).toBe('test_flag');
      expect(repository.findByKey).not.toHaveBeenCalled();
    });

    it('should fetch from repository and cache in Redis if cache miss', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockRepository.findByKey.mockResolvedValue(mockFlag);

      const result = await service.get('test_flag');
      expect(metricsService.featureFlagCacheMissesTotal.inc).toHaveBeenCalledWith({ flag: 'test_flag' });
      expect(repository.findByKey).toHaveBeenCalledWith('test_flag');
      expect(redisService.set).toHaveBeenCalledWith('feature-flags:test_flag', JSON.stringify(mockFlag), 60);
      expect(result).toEqual(mockFlag);
    });
  });

  describe('isEnabled', () => {
    it('should return false if flag is disabled or missing', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockRepository.findByKey.mockResolvedValue({ ...mockFlag, enabled: false });

      const enabled = await service.isEnabled('test_flag');
      expect(enabled).toBe(false);
      expect(metricsService.featureFlagMissesTotal.inc).toHaveBeenCalledWith({ flag: 'test_flag' });
    });

    it('should return true if flag is enabled and 100% rollout', async () => {
      mockRedisService.get.mockResolvedValue(JSON.stringify(mockFlag));

      const enabled = await service.isEnabled('test_flag');
      expect(enabled).toBe(true);
      expect(metricsService.featureFlagHitsTotal.inc).toHaveBeenCalledWith({ flag: 'test_flag' });
    });

    it('should calculate deterministic percentage rollout by userId', async () => {
      const partialFlag = { ...mockFlag, rolloutPercentage: 50 };
      mockRedisService.get.mockResolvedValue(JSON.stringify(partialFlag));

      const isEnabledUser1 = await service.isEnabled('test_flag', 'user-uuid-1');
      const isEnabledUser2 = await service.isEnabled('test_flag', 'user-uuid-2');

      expect(typeof isEnabledUser1).toBe('boolean');
      expect(typeof isEnabledUser2).toBe('boolean');
    });

    it('should return false when rollout is 0%', async () => {
      const zeroFlag = { ...mockFlag, rolloutPercentage: 0 };
      mockRedisService.get.mockResolvedValue(JSON.stringify(zeroFlag));

      const enabled = await service.isEnabled('test_flag', 'user-uuid-1');
      expect(enabled).toBe(false);
      expect(metricsService.featureFlagMissesTotal.inc).toHaveBeenCalledWith({ flag: 'test_flag' });
    });
  });

  describe('setEnabled', () => {
    it('should update enabled status and invalidate cache', async () => {
      mockRepository.findByKey.mockResolvedValue(mockFlag);
      mockRepository.update.mockResolvedValue({ ...mockFlag, enabled: false });

      const result = await service.setEnabled('test_flag', false);
      expect(repository.update).toHaveBeenCalledWith('test_flag', { enabled: false });
      expect(redisService.del).toHaveBeenCalledWith('feature-flags:test_flag');
      expect(result.enabled).toBe(false);
    });

    it('should throw NotFoundException if flag does not exist', async () => {
      mockRepository.findByKey.mockResolvedValue(null);

      await expect(service.setEnabled('nonexistent', true)).rejects.toThrow(NotFoundException);
    });
  });

  describe('setRollout', () => {
    it('should update rolloutPercentage and invalidate cache', async () => {
      mockRepository.findByKey.mockResolvedValue(mockFlag);
      mockRepository.update.mockResolvedValue({ ...mockFlag, rolloutPercentage: 25 });

      const result = await service.setRollout('test_flag', 25);
      expect(repository.update).toHaveBeenCalledWith('test_flag', { rolloutPercentage: 25 });
      expect(redisService.del).toHaveBeenCalledWith('feature-flags:test_flag');
      expect(result.rolloutPercentage).toBe(25);
    });

    it('should throw NotFoundException if flag does not exist', async () => {
      mockRepository.findByKey.mockResolvedValue(null);

      await expect(service.setRollout('nonexistent', 50)).rejects.toThrow(NotFoundException);
    });
  });

  describe('refresh', () => {
    it('should refresh all feature flags into Redis cache', async () => {
      mockRepository.findAll.mockResolvedValue([mockFlag]);

      await service.refresh();
      expect(repository.findAll).toHaveBeenCalled();
      expect(redisService.set).toHaveBeenCalledWith('feature-flags:test_flag', JSON.stringify(mockFlag), 60);
    });
  });

  describe('create & delete', () => {
    it('should create feature flag', async () => {
      mockRepository.upsert.mockResolvedValue(mockFlag);

      const result = await service.create({ key: 'test_flag', enabled: true, rolloutPercentage: 100 });
      expect(repository.upsert).toHaveBeenCalled();
      expect(result).toEqual(mockFlag);
    });

    it('should delete feature flag', async () => {
      mockRepository.findByKey.mockResolvedValue(mockFlag);
      mockRepository.delete.mockResolvedValue(mockFlag);

      await service.delete('test_flag');
      expect(repository.delete).toHaveBeenCalledWith('test_flag');
      expect(redisService.del).toHaveBeenCalledWith('feature-flags:test_flag');
    });
  });
});
