import { EventType } from '../enums/event-type.enum';
import { EventChannel } from '../enums/event-channel.enum';

export interface BaseEvent<T = any> {
  eventId: string;
  timestamp: string;
  correlationId: string;
  requestId?: string | null;
  userId?: string | null;
  aggregateId: string;
  aggregateType: string;
  payload: T;
  version: number;
  type: EventType | string;
  channel: EventChannel | string;
}
