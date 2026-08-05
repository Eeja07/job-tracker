import { Test, TestingModule } from '@nestjs/testing';
import { EventPublisherService } from './event-publisher.service';
import { RedisService } from '../../redis/redis.service';
import { MetricsService } from '../../../core/metrics/metrics.service';
import { EventType } from '../enums/event-type.enum';
import { EventChannel } from '../enums/event-channel.enum';

describe('EventPublisherService', () => {
  let service: EventPublisherService;
  let redisService: jest.Mocked<RedisService>;
  let metricsService: jest.Mocked<MetricsService>;

  beforeEach(async () => {
    const mockRedis = {
      publish: jest.fn().mockResolvedValue(1),
    };

    const mockMetrics = {
      eventsPublishedTotal: {
        inc: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventPublisherService,
        { provide: RedisService, useValue: mockRedis },
        { provide: MetricsService, useValue: mockMetrics },
      ],
    }).compile();

    service = module.get<EventPublisherService>(EventPublisherService);
    redisService = module.get(RedisService);
    metricsService = module.get(MetricsService);
  });

  it('should publish domain event with complete envelope metadata', async () => {
    const event = await service.publish({
      type: EventType.APPLICATION_CREATED,
      aggregateId: 'app-123',
      aggregateType: 'Application',
      userId: 'user-456',
      requestId: 'req-789',
      payload: { applicationId: 'app-123', status: 'APPLIED' },
    });

    expect(event.eventId).toBeDefined();
    expect(event.timestamp).toBeDefined();
    expect(event.correlationId).toBe(event.eventId);
    expect(event.channel).toBe(EventChannel.APPLICATION);
    expect(event.version).toBe(1);

    expect(redisService.publish).toHaveBeenCalledWith(
      EventChannel.APPLICATION,
      expect.stringContaining('app-123'),
    );
    expect(metricsService.eventsPublishedTotal.inc).toHaveBeenCalledWith({
      type: EventType.APPLICATION_CREATED,
      channel: EventChannel.APPLICATION,
    });
  });

  it('should handle Redis publish failure gracefully', async () => {
    redisService.publish.mockRejectedValue(new Error('Redis connection lost'));

    const event = await service.publish({
      type: EventType.USER_REGISTERED,
      aggregateId: 'user-111',
      aggregateType: 'User',
      payload: {
        userId: 'user-111',
        email: 'test@example.com',
        fullName: 'Test',
        role: 'USER',
      },
    });

    expect(event.eventId).toBeDefined();
  });
});
