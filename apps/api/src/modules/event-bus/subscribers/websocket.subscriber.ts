import { Injectable, Logger } from '@nestjs/common';
import { IEventSubscriber } from '../interfaces/event-subscriber.interface';
import { BaseEvent } from '../interfaces/base-event.interface';
import { EventType } from '../enums/event-type.enum';

@Injectable()
export class WebsocketSubscriber implements IEventSubscriber {
  readonly name = 'WebsocketSubscriber';
  readonly subscribedEvents = [
    EventType.APPLICATION_CREATED,
    EventType.APPLICATION_STATUS_CHANGED,
    EventType.ATTACHMENT_UPLOADED,
    EventType.FEATURE_FLAG_UPDATED,
  ];

  private readonly logger = new Logger(WebsocketSubscriber.name);

  async handle(event: BaseEvent): Promise<void> {
    this.logger.log(
      JSON.stringify({
        message: 'WebsocketSubscriber broadcasting realtime message',
        eventId: event.eventId,
        eventType: event.type,
        channel: event.channel,
        aggregateId: event.aggregateId,
      }),
    );
  }
}
