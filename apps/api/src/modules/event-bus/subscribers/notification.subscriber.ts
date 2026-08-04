import { Injectable, Logger } from '@nestjs/common';
import { IEventSubscriber } from '../interfaces/event-subscriber.interface';
import { BaseEvent } from '../interfaces/base-event.interface';
import { EventType } from '../enums/event-type.enum';

@Injectable()
export class NotificationSubscriber implements IEventSubscriber {
  readonly name = 'NotificationSubscriber';
  readonly subscribedEvents = [
    EventType.APPLICATION_STATUS_CHANGED,
    EventType.USER_REGISTERED,
    EventType.ROLE_ASSIGNED,
  ];

  private readonly logger = new Logger(NotificationSubscriber.name);

  async handle(event: BaseEvent): Promise<void> {
    this.logger.log(
      JSON.stringify({
        message: 'NotificationSubscriber queued alert notification',
        eventId: event.eventId,
        eventType: event.type,
        userId: event.userId || null,
        aggregateId: event.aggregateId,
      }),
    );
  }
}
