import { Test, TestingModule } from '@nestjs/testing';
import { EventBusService } from './event-bus.service';
import { EventPublisherService } from './event-publisher.service';
import { EventSubscriberService } from './event-subscriber.service';
import { AuditSubscriber } from '../subscribers/audit.subscriber';
import { EmailSubscriber } from '../subscribers/email.subscriber';
import { MetricsSubscriber } from '../subscribers/metrics.subscriber';
import { NotificationSubscriber } from '../subscribers/notification.subscriber';
import { WebsocketSubscriber } from '../subscribers/websocket.subscriber';
import { RedisService } from '../../redis/redis.service';
import { EventType } from '../enums/event-type.enum';

describe('EventBusService', () => {
  let service: EventBusService;
  let publisher: jest.Mocked<EventPublisherService>;
  let subscriberService: jest.Mocked<EventSubscriberService>;

  beforeEach(async () => {
    const mockPublisher = {
      publish: jest
        .fn()
        .mockImplementation((input) =>
          Promise.resolve({ ...input, eventId: 'uuid-1' }),
        ),
    };

    const mockSubscriberService = {
      registerSubscriber: jest.fn(),
      onModuleInit: jest.fn(),
    };

    const mockAuditSub = {
      name: 'AuditSubscriber',
      subscribedEvents: [],
      handle: jest.fn(),
    };
    const mockEmailSub = {
      name: 'EmailSubscriber',
      subscribedEvents: [],
      handle: jest.fn(),
    };
    const mockMetricsSub = {
      name: 'MetricsSubscriber',
      subscribedEvents: [],
      handle: jest.fn(),
    };
    const mockNotifSub = {
      name: 'NotificationSubscriber',
      subscribedEvents: [],
      handle: jest.fn(),
    };
    const mockWsSub = {
      name: 'WebsocketSubscriber',
      subscribedEvents: [],
      handle: jest.fn(),
    };

    const mockRedis = {
      isReady: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventBusService,
        { provide: EventPublisherService, useValue: mockPublisher },
        { provide: EventSubscriberService, useValue: mockSubscriberService },
        { provide: AuditSubscriber, useValue: mockAuditSub },
        { provide: EmailSubscriber, useValue: mockEmailSub },
        { provide: MetricsSubscriber, useValue: mockMetricsSub },
        { provide: NotificationSubscriber, useValue: mockNotifSub },
        { provide: WebsocketSubscriber, useValue: mockWsSub },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<EventBusService>(EventBusService);
    publisher = module.get(EventPublisherService);
    subscriberService = module.get(EventSubscriberService);
  });

  it('should initialize and register all subscribers on module init', () => {
    service.onModuleInit();
    expect(subscriberService.registerSubscriber).toHaveBeenCalledTimes(5);
  });

  it('should delegate publish to EventPublisherService', async () => {
    await service.publish({
      type: EventType.APPLICATION_CREATED,
      aggregateId: 'app-1',
      aggregateType: 'Application',
      payload: {},
    });

    expect(publisher.publish).toHaveBeenCalled();
  });
});
