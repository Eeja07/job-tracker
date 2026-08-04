import { Injectable, Logger } from '@nestjs/common';
import { IEventSubscriber } from '../interfaces/event-subscriber.interface';
import { BaseEvent } from '../interfaces/base-event.interface';

@Injectable()
export class MetricsSubscriber implements IEventSubscriber {
  readonly name = 'MetricsSubscriber';
  readonly subscribedEvents = ['*'];

  private readonly logger = new Logger(MetricsSubscriber.name);

  async handle(event: BaseEvent): Promise<void> {
    this.logger.log(
      JSON.stringify({
        message: 'MetricsSubscriber recorded domain event',
        eventId: event.eventId,
        eventType: event.type,
        channel: event.channel,
      }),
    );
  }
}
