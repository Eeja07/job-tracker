import { BaseEvent } from './base-event.interface';

export interface IEventSubscriber<T extends BaseEvent = BaseEvent> {
  readonly name: string;
  readonly subscribedEvents: (string | '*')[];
  handle(event: T): Promise<void>;
}
