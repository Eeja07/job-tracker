import { INestApplication } from '@nestjs/common';
import { createTestApp, TestAppSetup } from './test-utils';
import { EventPublisherService } from '../src/modules/event-bus/services/event-publisher.service';
import { EventSubscriberService } from '../src/modules/event-bus/services/event-subscriber.service';
import { EventType } from '../src/modules/event-bus/enums/event-type.enum';
import { BaseEvent } from '../src/modules/event-bus/interfaces/base-event.interface';
import { IEventSubscriber } from '../src/modules/event-bus/interfaces/event-subscriber.interface';
import { RedisService } from '../src/modules/redis/redis.service';

describe('Event Bus Module (e2e)', () => {
  let app: INestApplication;
  let publisher: EventPublisherService;
  let subscriberService: EventSubscriberService;
  let redisService: RedisService;

  beforeAll(async () => {
    const setup: TestAppSetup = await createTestApp();
    app = setup.app;
    publisher = app.get(EventPublisherService);
    subscriberService = app.get(EventSubscriberService);
    redisService = app.get(RedisService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('Event Publishing & Subscription Flow', () => {
    it('should publish ApplicationCreated event and trigger subscribed handler', async () => {
      const handledEvents: BaseEvent[] = [];
      const testSubscriber: IEventSubscriber = {
        name: 'E2EApplicationSubscriber',
        subscribedEvents: [EventType.APPLICATION_CREATED],
        handle: async (event) => {
          handledEvents.push(event);
        },
      };

      subscriberService.registerSubscriber(testSubscriber);

      const published = await publisher.publish({
        type: EventType.APPLICATION_CREATED,
        aggregateId: 'app-e2e-1',
        aggregateType: 'Application',
        userId: 'user-e2e-1',
        payload: { title: 'Software Engineer', companyId: 'comp-1' },
      });

      expect(published.eventId).toBeDefined();
      expect(published.channel).toBe('events:application');

      // Dispatch event to simulate Redis message reception
      await subscriberService.dispatchToSubscriber(testSubscriber, published);

      expect(handledEvents.length).toBe(1);
      expect(handledEvents[0].eventId).toBe(published.eventId);
    });

    it('should publish ApplicationStatusChanged event and process email subscriber', async () => {
      const handledEvents: BaseEvent[] = [];
      const emailTestSub: IEventSubscriber = {
        name: 'E2EEmailSubscriber',
        subscribedEvents: [
          EventType.APPLICATION_STATUS_CHANGED,
          EventType.EMAIL_SENT,
        ],
        handle: async (event) => {
          handledEvents.push(event);
        },
      };

      subscriberService.registerSubscriber(emailTestSub);

      const event = await publisher.publish({
        type: EventType.APPLICATION_STATUS_CHANGED,
        aggregateId: 'app-e2e-2',
        aggregateType: 'Application',
        userId: 'user-e2e-2',
        payload: { oldStatus: 'APPLIED', newStatus: 'INTERVIEW' },
      });

      await subscriberService.dispatchToSubscriber(emailTestSub, event);

      expect(handledEvents.length).toBe(1);
      expect(handledEvents[0].payload.newStatus).toBe('INTERVIEW');
    });

    it('should publish AuditCreated event and handle audit subscriber logging', async () => {
      const auditEvents: BaseEvent[] = [];
      const auditTestSub: IEventSubscriber = {
        name: 'E2EAuditSubscriber',
        subscribedEvents: [EventType.AUDIT_CREATED],
        handle: async (event) => {
          auditEvents.push(event);
        },
      };

      subscriberService.registerSubscriber(auditTestSub);

      const auditEvent = await publisher.publish({
        type: EventType.AUDIT_CREATED,
        aggregateId: 'audit-e2e-1',
        aggregateType: 'Audit',
        payload: { action: 'UPDATE_FLAG', resource: 'FeatureFlag' },
      });

      await subscriberService.dispatchToSubscriber(auditTestSub, auditEvent);

      expect(auditEvents.length).toBe(1);
      expect(auditEvents[0].type).toBe(EventType.AUDIT_CREATED);
    });
  });

  describe('Reliability, Retry, and Dead Letter Queue (DLQ)', () => {
    it('should retry failed subscriber executions up to 3 times before routing to DLQ', async () => {
      let attempts = 0;
      const failingSubscriber: IEventSubscriber = {
        name: 'E2EFailingSubscriber',
        subscribedEvents: [EventType.JOB_FAILED],
        handle: async () => {
          attempts++;
          throw new Error('E2E simulated failure');
        },
      };

      const failedEvent = await publisher.publish({
        type: EventType.JOB_FAILED,
        aggregateId: 'job-e2e-999',
        aggregateType: 'Job',
        payload: { error: 'Simulated exception' },
      });

      await subscriberService.dispatchToSubscriber(
        failingSubscriber,
        failedEvent,
      );

      // Initial attempt + 3 retries = 4 attempts total
      expect(attempts).toBe(4);

      if (redisService && redisService.isReady()) {
        const dlqKey = `events:dlq:${EventType.JOB_FAILED}:${failedEvent.eventId}`;
        const dlqRecord = await redisService.get(dlqKey);
        expect(dlqRecord).not.toBeNull();
        expect(dlqRecord).toContain('E2E simulated failure');
      }
    });
  });
});
