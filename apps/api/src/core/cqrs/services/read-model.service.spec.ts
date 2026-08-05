import { ReadModelService } from './read-model.service';

describe('ReadModelService', () => {
  let service: ReadModelService;
  let mockRedis: any;
  let mockMetrics: any;

  beforeEach(() => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn().mockResolvedValue([]),
    };
    mockMetrics = {
      queryCacheHitsTotal: { inc: jest.fn() },
      queryCacheMissesTotal: { inc: jest.fn() },
    };
    service = new ReadModelService(mockRedis, mockMetrics);
  });

  it('should return cached item from Redis if available', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify({ value: 'cached' }));
    const result = await service.get('test_key', 'TestQuery');

    expect(result).toEqual({ value: 'cached' });
    expect(mockMetrics.queryCacheHitsTotal.inc).toHaveBeenCalledWith({
      query: 'TestQuery',
    });
  });

  it('should fallback to in-memory store if Redis miss', async () => {
    mockRedis.get.mockResolvedValue(null);
    await service.set('my_key', { data: 123 }, 60);

    const result = await service.get('my_key', 'TestQuery');
    expect(result).toEqual({ data: 123 });
  });

  it('should invalidate specific key and pattern', async () => {
    await service.set('dashboard:user1', { data: 1 }, 60);
    await service.invalidate('dashboard:user1');

    const result = await service.get('dashboard:user1');
    expect(result).toBeNull();
  });
});
