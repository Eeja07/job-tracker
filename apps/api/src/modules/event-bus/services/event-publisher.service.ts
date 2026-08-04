import { Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from '../../redis/redis.service';
import { MetricsService } from '../../../core/metrics/metrics.service';
import { BaseEvent } from '../interfaces/base-event.interface';
import { getChannelForEventType } from '../enums/event-channel.enum';

export type EventPublishInput<T extends BaseEvent = BaseEvent> = Omit<
  T,
  'eventId' | 'timestamp' | 'correlationId' | 'channel' | 'version' | 'aggregateId' | 'aggregateType'
> & {
  eventId?: string;
  timestamp?: string;
  correlationId?: string;
  channel?: string;
  version?: number;
  aggregateId?: string;
  aggregateType?: string;
};

@Injectable()
export class EventPublisherService {
  private readonly logger = new Logger(EventPublisherService.name);

  constructor(
    @Optional() private readonly redisService?: RedisService,
    @Optional() private readonly metricsService?: MetricsService,
  ) {}

  /**
   * Publishes a domain event asynchronously to Redis Pub/Sub.
   * Fills in required event envelope fields if not provided.
   */
  async publish<T extends BaseEvent>(input: EventPublishInput<T>): Promise<T> {
    const eventId = input.eventId || randomUUID();
    const timestamp = input.timestamp || new Date().toISOString();
    const correlationId = input.correlationId || eventId;
    const version = input.version ?? 1;
    const channel = input.channel || getChannelForEventType(input.type);
    const aggregateId = input.aggregateId || eventId;
    const aggregateType = input.aggregateType || 'domain';

    const fullEvent: T = {
      ...input,
      eventId,
      timestamp,
      correlationId,
      version,
      channel,
      aggregateId,
      aggregateType,
    } as unknown as T;

    const payloadString = JSON.stringify(fullEvent);

    this.logger.log(
      JSON.stringify({
        message: 'Publishing domain event',
        eventId,
        eventType: fullEvent.type,
        channel,
        correlationId,
        requestId: fullEvent.requestId || null,
        userId: fullEvent.userId || null,
        aggregateId: fullEvent.aggregateId,
        aggregateType: fullEvent.aggregateType,
      }),
    );

    if (this.redisService) {
      try {
        const client = this.redisService.getClient?.();
        if (client && typeof client.xadd === 'function' && this.redisService.isReady()) {
          await client.xadd(channel, '*', 'event', payloadString);
        }
        await this.redisService.publish(channel, payloadString);
      } catch (err: any) {
        this.logger.error(
          JSON.stringify({
            message: 'Failed to publish event to Redis',
            eventId,
            eventType: fullEvent.type,
            channel,
            error: err.message,
          }),
        );
      }
    }

    if (this.metricsService) {
      this.metricsService.eventsPublishedTotal.inc({
        type: String(fullEvent.type),
        channel: String(channel),
      });
    }

    return fullEvent;
  }
}
