import { Test, TestingModule } from '@nestjs/testing';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { RedisService } from './redis.service';

describe('RedisThrottlerStorage', () => {
  let storage: RedisThrottlerStorage;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const mockRedisService = {
      increment: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisThrottlerStorage,
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    storage = module.get<RedisThrottlerStorage>(RedisThrottlerStorage);
    redisService = module.get(RedisService);
  });

  it('should increment key and set expire on first request', async () => {
    redisService.increment.mockResolvedValue(1);
    redisService.expire.mockResolvedValue(true);
    redisService.ttl.mockResolvedValue(60);

    const record = await storage.increment(
      '127.0.0.1',
      60000,
      100,
      0,
      'default',
    );

    expect(redisService.increment).toHaveBeenCalledWith(
      'throttler:default:127.0.0.1',
    );
    expect(redisService.expire).toHaveBeenCalledWith(
      'throttler:default:127.0.0.1',
      60,
    );
    expect(record.totalHits).toBe(1);
    expect(record.isBlocked).toBe(false);
  });

  it('should mark blocked when hits exceed limit', async () => {
    redisService.increment.mockResolvedValue(101);
    redisService.ttl.mockResolvedValue(45);

    const record = await storage.increment(
      '127.0.0.1',
      60000,
      100,
      0,
      'default',
    );

    expect(record.totalHits).toBe(101);
    expect(record.isBlocked).toBe(true);
    expect(record.timeToExpire).toBe(45);
  });

  it('should degrade gracefully on Redis exception', async () => {
    redisService.increment.mockRejectedValue(new Error('Redis cluster down'));

    const record = await storage.increment(
      '127.0.0.1',
      60000,
      100,
      0,
      'default',
    );

    expect(record.totalHits).toBe(1);
    expect(record.isBlocked).toBe(false);
  });
});
