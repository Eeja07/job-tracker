import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;
  let mockConfigService: Partial<ConfigService>;
  let mockRedisInstance: any;

  beforeEach(async () => {
    mockConfigService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'REDIS_HOST') return 'localhost';
        if (key === 'REDIS_PORT') return 6379;
        return '';
      }),
      get: jest.fn((key: string) => {
        if (key === 'REDIS_PASSWORD') return '';
        if (key === 'REDIS_DB') return 0;
        if (key === 'REDIS_TLS') return false;
        return null;
      }),
    };

    mockRedisInstance = {
      on: jest.fn(),
      status: 'ready',
      ping: jest.fn().mockResolvedValue('PONG'),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      ttl: jest.fn(),
      expire: jest.fn(),
      incr: jest.fn(),
      decr: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      duplicate: jest.fn().mockReturnThis(),
      keys: jest.fn(),
      info: jest.fn().mockResolvedValue('used_memory:102400'),
      quit: jest.fn().mockResolvedValue('OK'),
      disconnect: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    // Inject mock client directly for unit test
    (service as any).client = mockRedisInstance;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get & set', () => {
    it('should return value when key exists in get', async () => {
      mockRedisInstance.get.mockResolvedValue('cached-val');
      const res = await service.get('test-key');
      expect(res).toBe('cached-val');
      expect(mockRedisInstance.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null when key does not exist', async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      const res = await service.get('missing-key');
      expect(res).toBeNull();
    });

    it('should set key with ttl if provided', async () => {
      await service.set('my-key', 'my-val', 60);
      expect(mockRedisInstance.set).toHaveBeenCalledWith('my-key', 'my-val', 'EX', 60);
    });

    it('should set key without ttl if not provided', async () => {
      await service.set('my-key', 'my-val');
      expect(mockRedisInstance.set).toHaveBeenCalledWith('my-key', 'my-val');
    });
  });

  describe('del & delByPattern', () => {
    it('should delete a specific key', async () => {
      await service.del('key-to-del');
      expect(mockRedisInstance.del).toHaveBeenCalledWith('key-to-del');
    });

    it('should delete keys matching pattern in delByPattern', async () => {
      mockRedisInstance.keys.mockResolvedValue(['k1', 'k2']);
      await service.delByPattern('dashboard:*');
      expect(mockRedisInstance.keys).toHaveBeenCalledWith('dashboard:*');
      expect(mockRedisInstance.del).toHaveBeenCalledWith('k1', 'k2');
    });
  });

  describe('exists, ttl, expire', () => {
    it('should check existence', async () => {
      mockRedisInstance.exists.mockResolvedValue(1);
      const exists = await service.exists('k1');
      expect(exists).toBe(true);
    });

    it('should return ttl', async () => {
      mockRedisInstance.ttl.mockResolvedValue(45);
      const ttl = await service.ttl('k1');
      expect(ttl).toBe(45);
    });

    it('should set expire', async () => {
      mockRedisInstance.expire.mockResolvedValue(1);
      const ok = await service.expire('k1', 30);
      expect(ok).toBe(true);
    });
  });

  describe('increment & decrement', () => {
    it('should increment key', async () => {
      mockRedisInstance.incr.mockResolvedValue(10);
      const val = await service.increment('counter');
      expect(val).toBe(10);
    });

    it('should decrement key', async () => {
      mockRedisInstance.decr.mockResolvedValue(9);
      const val = await service.decrement('counter');
      expect(val).toBe(9);
    });
  });

  describe('Lock Helper', () => {
    it('should acquire lock using SET NX EX', async () => {
      mockRedisInstance.set.mockResolvedValue('OK');
      const acquired = await service.acquireLock('lock:job:123', 10);
      expect(acquired).toBe(true);
      expect(mockRedisInstance.set).toHaveBeenCalledWith('lock:job:123', 'locked', 'EX', 10, 'NX');
    });

    it('should fail to acquire lock if already held', async () => {
      mockRedisInstance.set.mockResolvedValue(null);
      const acquired = await service.acquireLock('lock:job:123', 10);
      expect(acquired).toBe(false);
    });

    it('should release lock by deleting key', async () => {
      mockRedisInstance.del.mockResolvedValue(1);
      const released = await service.releaseLock('lock:job:123');
      expect(released).toBe(true);
    });
  });

  describe('Pub/Sub', () => {
    it('should publish message to channel', async () => {
      mockRedisInstance.publish.mockResolvedValue(1);
      const subs = await service.publish('events', 'hello');
      expect(subs).toBe(1);
    });

    it('should subscribe handler to channel', async () => {
      const mockSubClient = {
        subscribe: jest.fn().mockResolvedValue('OK'),
        on: jest.fn(),
      };
      mockRedisInstance.duplicate.mockReturnValue(mockSubClient);

      const handler = jest.fn();
      await service.subscribe('events', handler);

      expect(mockRedisInstance.duplicate).toHaveBeenCalled();
      expect(mockSubClient.subscribe).toHaveBeenCalledWith('events');
    });
  });

  describe('Observability & Metrics', () => {
    it('should return correct hit ratio and memory metrics', async () => {
      mockRedisInstance.get.mockResolvedValue('hit1');
      await service.get('k1'); // hit

      mockRedisInstance.get.mockResolvedValue(null);
      await service.get('k2'); // miss

      const metrics = await service.getMetrics();
      expect(metrics.status).toBe('ready');
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
      expect(metrics.hitRatio).toBe(0.5);
      expect(metrics.memoryUsageBytes).toBe(102400);
    });
  });
});
