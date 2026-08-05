import { Test, TestingModule } from '@nestjs/testing';
import { EventSubscriberService } from './event-subscriber.service';
import { RedisService } from '../../redis/redis.service';
import { MetricsService } from '../../../core/metrics/metrics.service';
import { IEventSubscriber } from '../interfaces/event-subscriber.interface';
import { BaseEvent } from '../interfaces/base-event.interface';
import { EventType } from '../enums/event-type.enum';

describe('EventSubscriberService', () => {
  let service: EventSubscriberService;
  let redisService: jest.Mocked<RedisService>;
  let metricsService: jest.Mocked<MetricsService>;

  beforeEach(async () => {
    const mockRedis = {
      subscribe: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(false),
      acquireLock: jest.fn().mockResolvedValue('claim-token-123'),
      set: jest.fn().mockResolvedValue(undefined),
      isReady: jest.fn().mockReturnValue(true),
    };

    const mockMetrics = {
      eventsConsumedTotal: { inc: jest.fn() },
      eventsFailedTotal: { inc: jest.fn() },
      eventsRetryTotal: { inc: jest.fn() },
      eventsDlqTotal: { inc: jest.fn() },
      eventProcessingDurationSeconds: { observe: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventSubscriberService,
        { provide: RedisService, useValue: mockRedis },
        { provide: MetricsService, useValue: mockMetrics },
      ],
    }).compile();

    service = module.get<EventSubscriberService>(EventSubscriberService);
    redisService = module.get(RedisService);
    metricsService = module.get(MetricsService);
  });

  const mockEvent: BaseEvent = {
    eventId: 'event-uuid-123',
    timestamp: new Date().toISOString(),
    correlationId: 'corr-123',
    aggregateId: 'app-1',
    aggregateType: 'Application',
    payload: {},
    version: 1,
    type: EventType.APPLICATION_CREATED,
    channel: 'events:application',
  };

  it('should dispatch incoming event to matching subscriber with atomic claim', async () => {
    const mockSubscriber: jest.Mocked<IEventSubscriber> = {
      name: 'TestSubscriber',
      subscribedEvents: [EventType.APPLICATION_CREATED],
      handle: jest.fn().mockResolvedValue(undefined),
    };

    service.registerSubscriber(mockSubscriber);
    await service.dispatchToSubscriber(mockSubscriber, mockEvent);

    expect(mockSubscriber.handle).toHaveBeenCalledWith(mockEvent);
    expect(redisService.acquireLock).toHaveBeenCalledWith(
      expect.stringContaining('events:processed:TestSubscriber:event-uuid-123'),
      86400,
    );
    expect(metricsService.eventsConsumedTotal.inc).toHaveBeenCalled();
  });

  it('should skip execution if atomic claim fails (Idempotency)', async () => {
    redisService.acquireLock.mockResolvedValue(null);

    const mockSubscriber: jest.Mocked<IEventSubscriber> = {
      name: 'TestSubscriber',
      subscribedEvents: ['*'],
      handle: jest.fn(),
    };

    service.registerSubscriber(mockSubscriber);
    await service.dispatchToSubscriber(mockSubscriber, mockEvent);

    expect(mockSubscriber.handle).not.toHaveBeenCalled();
  });

  it('should retry failed execution and move event to DLQ if max retries exceeded', async () => {
    const mockSubscriber: jest.Mocked<IEventSubscriber> = {
      name: 'FailingSubscriber',
      subscribedEvents: [EventType.APPLICATION_CREATED],
      handle: jest.fn().mockRejectedValue(new Error('Persistent error')),
    };

    service.registerSubscriber(mockSubscriber);
    await service.dispatchToSubscriber(mockSubscriber, mockEvent);

    // 1 initial attempt + 3 retries = 4 attempts total
    expect(mockSubscriber.handle).toHaveBeenCalledTimes(4);
    expect(metricsService.eventsRetryTotal.inc).toHaveBeenCalledTimes(3);
    expect(metricsService.eventsFailedTotal.inc).toHaveBeenCalled();
    expect(metricsService.eventsDlqTotal.inc).toHaveBeenCalledWith({
      type: EventType.APPLICATION_CREATED,
    });
    expect(redisService.set).toHaveBeenCalledWith(
      expect.stringContaining(
        `events:dlq:${EventType.APPLICATION_CREATED}:event-uuid-123`,
      ),
      expect.stringContaining('Persistent error'),
      604800,
    );
  });
});
