import { Test, TestingModule } from '@nestjs/testing';
import { PresenceService } from './presence.service';
import { RedisService } from '../../redis/redis.service';

describe('PresenceService', () => {
  let service: PresenceService;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const mockRedisClient = {
      sadd: jest.fn().mockResolvedValue(1),
      srem: jest.fn().mockResolvedValue(1),
      scard: jest.fn().mockResolvedValue(0),
    };

    const mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(false),
      expire: jest.fn().mockResolvedValue(true),
      getClient: jest.fn().mockReturnValue(mockRedisClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresenceService,
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<PresenceService>(PresenceService);
    redisService = module.get(RedisService);
  });

  it('should register a new connection and write presence to Redis', async () => {
    await service.registerConnection('user-1', 'socket-1');
    expect(redisService.set).toHaveBeenCalledWith(
      'ws:presence:user-1',
      expect.stringContaining('user-1'),
      expect.any(Number),
    );
  });

  it('should increment tab count on second connection for same user', async () => {
    const existing = JSON.stringify({
      userId: 'user-1',
      socketId: 'socket-1',
      connectedAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
      tabCount: 1,
    });
    (redisService.get as jest.Mock).mockResolvedValue(existing);

    await service.registerConnection('user-1', 'socket-2');

    const setCall = (redisService.set as jest.Mock).mock.calls[0];
    const record = JSON.parse(setCall[1]);
    expect(record.tabCount).toBe(2);
  });

  it('should remove connection and clear presence when last tab disconnects', async () => {
    const mockRedisClient = (
      redisService.getClient as jest.Mock
    ).mockReturnValue({
      sadd: jest.fn(),
      srem: jest.fn().mockResolvedValue(1),
      scard: jest.fn().mockResolvedValue(0), // 0 remaining
    });

    await service.removeConnection('user-1', 'socket-1');
    expect(redisService.del).toHaveBeenCalled();
  });

  it('should update heartbeat timestamp', async () => {
    const existing = JSON.stringify({
      userId: 'user-1',
      socketId: 'socket-1',
      connectedAt: new Date().toISOString(),
      lastHeartbeat: new Date(Date.now() - 30000).toISOString(),
      tabCount: 1,
    });
    (redisService.get as jest.Mock).mockResolvedValue(existing);

    await service.updateHeartbeat('user-1');
    expect(redisService.set).toHaveBeenCalled();
  });

  it('isOnline should return false when no presence key exists', async () => {
    (redisService.exists as jest.Mock).mockResolvedValue(false);
    const result = await service.isOnline('user-1');
    expect(result).toBe(false);
  });

  it('isOnline should return true when presence key exists', async () => {
    (redisService.exists as jest.Mock).mockResolvedValue(true);
    const result = await service.isOnline('user-1');
    expect(result).toBe(true);
  });
});
