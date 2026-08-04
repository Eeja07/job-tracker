import { Injectable, Logger, Optional } from '@nestjs/common';
import { IEventSubscriber } from '../interfaces/event-subscriber.interface';
import { BaseEvent } from '../interfaces/base-event.interface';
import { EventType } from '../enums/event-type.enum';
import { AuditLogRepository } from '../../../repositories/audit-log/audit-log.repository';

@Injectable()
export class AuditSubscriber implements IEventSubscriber {
  readonly name = 'AuditSubscriber';
  readonly subscribedEvents = [
    EventType.AUDIT_CREATED,
    EventType.APPLICATION_CREATED,
    EventType.APPLICATION_STATUS_CHANGED,
    EventType.ROLE_ASSIGNED,
    EventType.ROLE_REMOVED,
    EventType.FEATURE_FLAG_UPDATED,
  ];

  private readonly logger = new Logger(AuditSubscriber.name);

  constructor(@Optional() private readonly auditLogRepository?: AuditLogRepository) {}

  async handle(event: BaseEvent): Promise<void> {
    this.logger.log(
      JSON.stringify({
        message: 'AuditSubscriber processing event',
        eventId: event.eventId,
        eventType: event.type,
        aggregateId: event.aggregateId,
      }),
    );

    if (this.auditLogRepository && event.type !== EventType.AUDIT_CREATED) {
      try {
        await this.auditLogRepository.create({
          userId: event.userId || null,
          action: `EVENT_${event.type}`,
          resource: event.aggregateType,
          resourceId: event.aggregateId,
          method: 'EVENT_BUS',
          endpoint: `/events/${event.channel}`,
          ipAddress: '127.0.0.1',
          userAgent: 'EventBus/1.0',
          requestId: event.requestId || event.correlationId,
          metadata: event.payload || {},
        });
      } catch (err: any) {
        this.logger.warn(`Failed to log audit entry in AuditSubscriber: ${err.message}`);
      }
    }
  }
}
