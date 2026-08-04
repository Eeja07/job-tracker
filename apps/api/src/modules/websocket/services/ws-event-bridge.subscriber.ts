import { Injectable, Logger } from '@nestjs/common';
import { IEventSubscriber } from '../../event-bus/interfaces/event-subscriber.interface';
import { BaseEvent } from '../../event-bus/interfaces/base-event.interface';
import { EventType } from '../../event-bus/enums/event-type.enum';
import { RealtimePublisher } from './realtime-publisher.service';
import { WsServerEvent } from '../constants/ws-events.constants';
import { userRoom, applicationRoom, companyRoom } from '../constants/ws-rooms.constants';

/**
 * Bridges Event Bus domain events to Socket.IO room-targeted broadcasts.
 * Registered as an EventBus subscriber via EventSubscriberService.
 */
@Injectable()
export class WsEventBridgeSubscriber implements IEventSubscriber {
  readonly name = 'WsEventBridgeSubscriber';
  readonly subscribedEvents = [
    EventType.APPLICATION_CREATED,
    EventType.APPLICATION_UPDATED,
    EventType.APPLICATION_STATUS_CHANGED,
    EventType.ATTACHMENT_UPLOADED,
    EventType.ATTACHMENT_DELETED,
    EventType.COMPANY_CREATED,
    EventType.COMPANY_DELETED,
    EventType.AUDIT_CREATED,
    EventType.FEATURE_FLAG_UPDATED,
    EventType.ROLE_ASSIGNED,
    EventType.ROLE_REMOVED,
    EventType.EMAIL_SENT,
    EventType.JOB_COMPLETED,
    EventType.JOB_FAILED,
  ];

  private readonly logger = new Logger(WsEventBridgeSubscriber.name);

  constructor(private readonly publisher: RealtimePublisher) {}

  async handle(event: BaseEvent): Promise<void> {
    this.logger.log(
      JSON.stringify({
        message: 'WsEventBridgeSubscriber routing domain event',
        eventId: event.eventId,
        eventType: event.type,
        correlationId: event.correlationId,
      }),
    );

    switch (event.type) {
      case EventType.APPLICATION_CREATED: {
        const p = event.payload;
        // Notify the user who created the application
        this.publisher.emitToRoom(
          userRoom(p.userId || event.userId || ''),
          WsServerEvent.APPLICATION_CREATED,
          { eventId: event.eventId, correlationId: event.correlationId, payload: p },
        );
        // Notify the specific application room if subscribers exist
        if (p.applicationId) {
          this.publisher.emitToRoom(
            applicationRoom(p.applicationId),
            WsServerEvent.APPLICATION_CREATED,
            { eventId: event.eventId, correlationId: event.correlationId, payload: p },
          );
        }
        break;
      }

      case EventType.APPLICATION_UPDATED: {
        const p = event.payload;
        if (p.applicationId) {
          this.publisher.emitToRoom(
            applicationRoom(p.applicationId),
            WsServerEvent.APPLICATION_UPDATED,
            { eventId: event.eventId, correlationId: event.correlationId, payload: p },
          );
        }
        if (p.userId || event.userId) {
          this.publisher.emitToRoom(
            userRoom(p.userId || event.userId),
            WsServerEvent.APPLICATION_UPDATED,
            { eventId: event.eventId, correlationId: event.correlationId, payload: p },
          );
        }
        break;
      }

      case EventType.APPLICATION_STATUS_CHANGED: {
        const p = event.payload;
        if (p.applicationId) {
          this.publisher.emitToRoom(
            applicationRoom(p.applicationId),
            WsServerEvent.APPLICATION_STATUS_CHANGED,
            { eventId: event.eventId, correlationId: event.correlationId, payload: p },
          );
        }
        if (p.userId || event.userId) {
          this.publisher.emitToRoom(
            userRoom(p.userId || event.userId),
            WsServerEvent.APPLICATION_STATUS_CHANGED,
            { eventId: event.eventId, correlationId: event.correlationId, payload: p },
          );
        }
        break;
      }

      case EventType.ATTACHMENT_UPLOADED:
      case EventType.ATTACHMENT_DELETED: {
        const p = event.payload;
        const wsEvent =
          event.type === EventType.ATTACHMENT_UPLOADED
            ? WsServerEvent.ATTACHMENT_UPLOADED
            : WsServerEvent.ATTACHMENT_DELETED;
        if (p.applicationId) {
          this.publisher.emitToRoom(
            applicationRoom(p.applicationId),
            wsEvent,
            { eventId: event.eventId, correlationId: event.correlationId, payload: p },
          );
        }
        if (p.userId || event.userId) {
          this.publisher.emitToRoom(
            userRoom(p.userId || event.userId),
            wsEvent,
            { eventId: event.eventId, correlationId: event.correlationId, payload: p },
          );
        }
        break;
      }

      case EventType.COMPANY_CREATED:
      case EventType.COMPANY_DELETED: {
        const p = event.payload;
        const wsEvent =
          event.type === EventType.COMPANY_CREATED
            ? WsServerEvent.COMPANY_CREATED
            : WsServerEvent.COMPANY_DELETED;
        if (p.companyId) {
          this.publisher.emitToRoom(
            companyRoom(p.companyId),
            wsEvent,
            { eventId: event.eventId, correlationId: event.correlationId, payload: p },
          );
        }
        break;
      }

      case EventType.AUDIT_CREATED: {
        // Admin room only
        this.publisher.emitToRoom(
          'admin',
          WsServerEvent.AUDIT_CREATED,
          { eventId: event.eventId, correlationId: event.correlationId, payload: event.payload },
        );
        break;
      }

      case EventType.FEATURE_FLAG_UPDATED: {
        // Broadcast to admin room (flag changes are system-wide)
        this.publisher.emitToRoom(
          'admin',
          WsServerEvent.FEATURE_FLAG_UPDATED,
          { eventId: event.eventId, correlationId: event.correlationId, payload: event.payload },
        );
        break;
      }

      case EventType.ROLE_ASSIGNED:
      case EventType.ROLE_REMOVED: {
        const p = event.payload;
        const wsEvent =
          event.type === EventType.ROLE_ASSIGNED
            ? WsServerEvent.ROLE_ASSIGNED
            : WsServerEvent.ROLE_REMOVED;
        if (p.userId) {
          this.publisher.emitToRoom(
            userRoom(p.userId),
            wsEvent,
            { eventId: event.eventId, correlationId: event.correlationId, payload: p },
          );
        }
        break;
      }

      case EventType.EMAIL_SENT: {
        if (event.userId) {
          this.publisher.emitToRoom(
            userRoom(event.userId),
            WsServerEvent.EMAIL_SENT,
            { eventId: event.eventId, correlationId: event.correlationId, payload: event.payload },
          );
        }
        break;
      }

      case EventType.JOB_COMPLETED:
      case EventType.JOB_FAILED: {
        const wsEvent =
          event.type === EventType.JOB_COMPLETED
            ? WsServerEvent.JOB_COMPLETED
            : WsServerEvent.JOB_FAILED;
        this.publisher.emitToRoom(
          'admin',
          wsEvent,
          { eventId: event.eventId, correlationId: event.correlationId, payload: event.payload },
        );
        break;
      }

      default:
        this.logger.log(
          JSON.stringify({
            message: 'WsEventBridgeSubscriber: no routing rule for event type',
            eventType: event.type,
          }),
        );
    }
  }
}
