import { Test, TestingModule } from '@nestjs/testing';
import { WsEventBridgeSubscriber } from './ws-event-bridge.subscriber';
import { RealtimePublisher } from './realtime-publisher.service';
import { EventType } from '../../event-bus/enums/event-type.enum';
import { BaseEvent } from '../../event-bus/interfaces/base-event.interface';
import { WsServerEvent } from '../constants/ws-events.constants';

function makeEvent(
  type: EventType,
  payload: Record<string, any>,
  extra: Partial<BaseEvent> = {},
): BaseEvent {
  return {
    eventId: 'evt-1',
    timestamp: new Date().toISOString(),
    correlationId: 'corr-1',
    aggregateId: 'agg-1',
    aggregateType: 'Test',
    payload,
    version: 1,
    type,
    channel: 'events:application',
    ...extra,
  };
}

describe('WsEventBridgeSubscriber', () => {
  let subscriber: WsEventBridgeSubscriber;
  let publisher: jest.Mocked<RealtimePublisher>;

  beforeEach(async () => {
    const mockPublisher = {
      emitToRoom: jest.fn(),
      emitToSocket: jest.fn(),
      broadcast: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WsEventBridgeSubscriber,
        { provide: RealtimePublisher, useValue: mockPublisher },
      ],
    }).compile();

    subscriber = module.get<WsEventBridgeSubscriber>(WsEventBridgeSubscriber);
    publisher = module.get(RealtimePublisher);
  });

  it('should emit to user room and application room on APPLICATION_CREATED', async () => {
    const event = makeEvent(EventType.APPLICATION_CREATED, {
      applicationId: 'app-1',
      userId: 'user-1',
      title: 'Engineer',
      companyId: 'comp-1',
      status: 'APPLIED',
    });
    await subscriber.handle(event);
    expect(publisher.emitToRoom).toHaveBeenCalledWith(
      'user:user-1',
      WsServerEvent.APPLICATION_CREATED,
      expect.objectContaining({ eventId: 'evt-1' }),
    );
    expect(publisher.emitToRoom).toHaveBeenCalledWith(
      'application:app-1',
      WsServerEvent.APPLICATION_CREATED,
      expect.anything(),
    );
  });

  it('should emit to admin room on AUDIT_CREATED', async () => {
    const event = makeEvent(EventType.AUDIT_CREATED, {
      auditId: 'audit-1',
      action: 'CREATE',
      resource: 'Application',
    });
    await subscriber.handle(event);
    expect(publisher.emitToRoom).toHaveBeenCalledWith(
      'admin',
      WsServerEvent.AUDIT_CREATED,
      expect.anything(),
    );
  });

  it('should emit to user room on ROLE_ASSIGNED', async () => {
    const event = makeEvent(EventType.ROLE_ASSIGNED, {
      userId: 'user-1',
      roleId: 'role-1',
      roleName: 'ADMIN',
    });
    await subscriber.handle(event);
    expect(publisher.emitToRoom).toHaveBeenCalledWith(
      'user:user-1',
      WsServerEvent.ROLE_ASSIGNED,
      expect.anything(),
    );
  });

  it('should emit to company room on COMPANY_CREATED', async () => {
    const event = makeEvent(EventType.COMPANY_CREATED, {
      companyId: 'comp-1',
      name: 'Acme',
    });
    await subscriber.handle(event);
    expect(publisher.emitToRoom).toHaveBeenCalledWith(
      'company:comp-1',
      WsServerEvent.COMPANY_CREATED,
      expect.anything(),
    );
  });

  it('should emit to admin room on FEATURE_FLAG_UPDATED', async () => {
    const event = makeEvent(EventType.FEATURE_FLAG_UPDATED, {
      flagKey: 'NEW_FEATURE',
      enabled: true,
      rolloutPercentage: 100,
    });
    await subscriber.handle(event);
    expect(publisher.emitToRoom).toHaveBeenCalledWith(
      'admin',
      WsServerEvent.FEATURE_FLAG_UPDATED,
      expect.anything(),
    );
  });

  it('should emit to admin room on JOB_FAILED', async () => {
    const event = makeEvent(EventType.JOB_FAILED, {
      jobId: 'job-1',
      queueName: 'email',
      error: 'SMTP error',
      attempts: 3,
    });
    await subscriber.handle(event);
    expect(publisher.emitToRoom).toHaveBeenCalledWith(
      'admin',
      WsServerEvent.JOB_FAILED,
      expect.anything(),
    );
  });
});
