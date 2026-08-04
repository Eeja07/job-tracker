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
      unsubscribe: jest.fn(),
      scan: jest.fn(),
      eval: jest.fn(),
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

    it('should delete keys matching pattern in delByPattern using SCAN', async () => {
      mockRedisInstance.scan.mockResolvedValue(['0', ['k1', 'k2']]);
      await service.delByPattern('dashboard:*');
      expect(mockRedisInstance.scan).toHaveBeenCalledWith('0', 'MATCH', 'dashboard:*', 'COUNT', 100);
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
    it('should acquire lock using SET NX EX and return lock token', async () => {
      mockRedisInstance.set.mockResolvedValue('OK');
      const token = await service.acquireLock('lock:job:123', 10);
      expect(typeof token).toBe('string');
      expect(token).not.toBeNull();
      expect(mockRedisInstance.set).toHaveBeenCalledWith('lock:job:123', expect.any(String), 'EX', 10, 'NX');
    });

    it('should acquire lock with custom token', async () => {
      mockRedisInstance.set.mockResolvedValue('OK');
      const token = await service.acquireLock('lock:job:123', 10, 'my-custom-token');
      expect(token).toBe('my-custom-token');
      expect(mockRedisInstance.set).toHaveBeenCalledWith('lock:job:123', 'my-custom-token', 'EX', 10, 'NX');
    });

    it('should return null if lock is already held', async () => {
      mockRedisInstance.set.mockResolvedValue(null);
      const token = await service.acquireLock('lock:job:123', 10);
      expect(token).toBeNull();
    });

    it('should release lock using Lua compare-and-delete when token is provided', async () => {
      mockRedisInstance.eval.mockResolvedValue(1);
      const released = await service.releaseLock('lock:job:123', 'my-token');
      expect(released).toBe(true);
      expect(mockRedisInstance.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call("get", KEYS[1])'),
        1,
        'lock:job:123',
        'my-token',
      );
    });

    it('should fail to release lock if Lua script returns 0 (token mismatch)', async () => {
      mockRedisInstance.eval.mockResolvedValue(0);
      const released = await service.releaseLock('lock:job:123', 'wrong-token');
      expect(released).toBe(false);
    });

    it('should fallback to direct delete when token is omitted', async () => {
      mockRedisInstance.del.mockResolvedValue(1);
      const released = await service.releaseLock('lock:job:123');
      expect(released).toBe(true);
      expect(mockRedisInstance.del).toHaveBeenCalledWith('lock:job:123');
    });
  });

  describe('Pub/Sub', () => {
    it('should publish message to channel', async () => {
      mockRedisInstance.publish.mockResolvedValue(1);
      const subs = await service.publish('events', 'hello');
      expect(subs).toBe(1);
    });

    it('should register a single global message listener and dispatch to handlers', async () => {
      let messageListener: (chan: string, msg: string) => void = () => {};
      const mockSubClient = {
        subscribe: jest.fn().mockResolvedValue('OK'),
        unsubscribe: jest.fn().mockResolvedValue('OK'),
        on: jest.fn((event: string, cb: any) => {
          if (event === 'message') {
            messageListener = cb;
          }
        }),
      };
      mockRedisInstance.duplicate.mockReturnValue(mockSubClient);

      const handler1 = jest.fn();
      const handler2 = jest.fn();

      await service.subscribe('channel1', handler1);
      await service.subscribe('channel1', handler2);

      expect(mockSubClient.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockSubClient.subscribe).toHaveBeenCalledTimes(1);
      expect(mockSubClient.subscribe).toHaveBeenCalledWith('channel1');

      // Simulate incoming message
      messageListener('channel1', 'test-payload');
      expect(handler1).toHaveBeenCalledWith('test-payload');
      expect(handler2).toHaveBeenCalledWith('test-payload');

      // Unsubscribe one handler
      await service.unsubscribe('channel1', handler1);
      expect(mockSubClient.unsubscribe).not.toHaveBeenCalled();

      // Unsubscribe final handler
      await service.unsubscribe('channel1', handler2);
      expect(mockSubClient.unsubscribe).toHaveBeenCalledWith('channel1');
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

