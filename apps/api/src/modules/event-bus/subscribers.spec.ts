import { AuditSubscriber } from './subscribers/audit.subscriber';
import { EmailSubscriber } from './subscribers/email.subscriber';
import { MetricsSubscriber } from './subscribers/metrics.subscriber';
import { NotificationSubscriber } from './subscribers/notification.subscriber';
import { WebsocketSubscriber } from './subscribers/websocket.subscriber';
import { EventType } from './enums/event-type.enum';
import { BaseEvent } from './interfaces/base-event.interface';

describe('Subscribers', () => {
  const baseEvent: BaseEvent = {
    eventId: 'e-1',
    timestamp: new Date().toISOString(),
    correlationId: 'c-1',
    aggregateId: 'a-1',
    aggregateType: 'Application',
    userId: 'u-1',
    requestId: 'r-1',
    payload: { fullName: 'Jane Doe', email: 'jane@example.com' },
    version: 1,
    type: EventType.USER_REGISTERED,
    channel: 'events:user',
  };

  it('AuditSubscriber handle should process event', async () => {
    const mockRepo = { create: jest.fn().mockResolvedValue({}) };
    const subscriber = new AuditSubscriber(mockRepo as any);
    await subscriber.handle(baseEvent);
    expect(mockRepo.create).toHaveBeenCalled();
  });

  it('EmailSubscriber handle should process welcome email event', async () => {
    const mockEmailService = { sendTemplate: jest.fn().mockResolvedValue({}) };
    const subscriber = new EmailSubscriber(mockEmailService as any);
    await subscriber.handle(baseEvent);
    expect(mockEmailService.sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'jane@example.com' }),
    );
  });

  it('MetricsSubscriber handle should complete without throwing', async () => {
    const subscriber = new MetricsSubscriber();
    await expect(subscriber.handle(baseEvent)).resolves.not.toThrow();
  });

  it('NotificationSubscriber handle should complete without throwing', async () => {
    const subscriber = new NotificationSubscriber();
    await expect(subscriber.handle(baseEvent)).resolves.not.toThrow();
  });

  it('WebsocketSubscriber handle should complete without throwing', async () => {
    const subscriber = new WebsocketSubscriber();
    await expect(subscriber.handle(baseEvent)).resolves.not.toThrow();
  });
});
