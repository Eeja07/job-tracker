import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { MetricsService } from '../../../core/metrics/metrics.service';
import { BaseEvent } from '../interfaces/base-event.interface';
import { IEventSubscriber } from '../interfaces/event-subscriber.interface';
import { EventChannel } from '../enums/event-channel.enum';

const MAX_RETRIES = 3;
const IDEMPOTENCY_TTL_SECONDS = 86400; // 24 hours
const DLQ_PREFIX = 'events:dlq:';
const PROCESSED_PREFIX = 'events:processed:';

@Injectable()
export class EventSubscriberService implements OnModuleInit {
  private readonly logger = new Logger(EventSubscriberService.name);
  private readonly subscribers: IEventSubscriber[] = [];

  constructor(
    @Optional() private readonly redisService?: RedisService,
    @Optional() private readonly metricsService?: MetricsService,
  ) {}

  registerSubscriber(subscriber: IEventSubscriber): void {
    this.subscribers.push(subscriber);
    this.logger.log(
      JSON.stringify({
        message: 'Registered event subscriber',
        subscriberName: subscriber.name,
        subscribedEvents: subscriber.subscribedEvents,
      }),
    );
  }

  async onModuleInit(): Promise<void> {
    if (!this.redisService) {
      this.logger.warn('RedisService not provided. EventSubscriberService running without Pub/Sub listener.');
      return;
    }

    const channels = Object.values(EventChannel);
    for (const channel of channels) {
      await this.redisService.subscribe(channel, (message: string) => {
        // Asynchronously process incoming Redis Pub/Sub messages without blocking
        this.processIncomingMessage(channel, message).catch((err) => {
          this.logger.error(
            JSON.stringify({
              message: 'Unhandled error processing channel message',
              channel,
              error: err.message,
            }),
          );
        });
      });
    }

    this.logger.log(`EventSubscriberService listening on channels: ${channels.join(', ')}`);
  }

  /**
   * Parses incoming message and routes to matching subscribers asynchronously.
   */
  async processIncomingMessage(channel: string, messageString: string): Promise<void> {
    let event: BaseEvent;
    try {
      event = JSON.parse(messageString);
    } catch (err: any) {
      this.logger.error(`Failed to parse event JSON from channel [${channel}]: ${err.message}`);
      return;
    }

    const matchingSubscribers = this.subscribers.filter(
      (sub) => sub.subscribedEvents.includes('*') || sub.subscribedEvents.includes(event.type),
    );

    if (matchingSubscribers.length === 0) {
      return;
    }

    // Process all matching subscribers in parallel, non-blocking
    await Promise.allSettled(
      matchingSubscribers.map((subscriber) => this.dispatchToSubscriber(subscriber, event)),
    );
  }

  /**
   * Dispatches event to a single subscriber with idempotency checks, retries, and DLQ handling.
   */
  async dispatchToSubscriber(subscriber: IEventSubscriber, event: BaseEvent): Promise<void> {
    const idempotencyKey = `${PROCESSED_PREFIX}${subscriber.name}:${event.eventId}`;

    // 1. Idempotency / Duplicate Detection Check
    if (this.redisService) {
      const isAlreadyProcessed = await this.redisService.exists(idempotencyKey);
      if (isAlreadyProcessed) {
        this.logger.log(
          JSON.stringify({
            message: 'Duplicate event detected, skipping subscriber execution',
            subscriberName: subscriber.name,
            eventId: event.eventId,
            eventType: event.type,
          }),
        );
        return;
      }
    }

    const startTime = Date.now();
    let attempt = 0;
    let success = false;

    // 2. Retry Loop with Exponential Backoff
    while (attempt <= MAX_RETRIES && !success) {
      try {
        if (attempt > 0) {
          this.logger.warn(
            JSON.stringify({
              message: 'Retrying event execution',
              subscriberName: subscriber.name,
              eventId: event.eventId,
              eventType: event.type,
              attempt,
            }),
          );

          if (this.metricsService) {
            this.metricsService.eventsRetryTotal.inc({
              type: String(event.type),
              subscriber: subscriber.name,
            });
          }

          // Backoff delay: 50ms * 2^(attempt-1)
          await new Promise((resolve) => setTimeout(resolve, 50 * Math.pow(2, attempt - 1)));
        }

        await subscriber.handle(event);
        success = true;
      } catch (err: any) {
        attempt++;
        if (attempt > MAX_RETRIES) {
          this.logger.error(
            JSON.stringify({
              message: 'Event processing failed after maximum retries',
              subscriberName: subscriber.name,
              eventId: event.eventId,
              eventType: event.type,
              error: err.message,
              attempts: attempt,
            }),
          );

          if (this.metricsService) {
            this.metricsService.eventsFailedTotal.inc({
              type: String(event.type),
              subscriber: subscriber.name,
            });
          }

          // 3. Move to Dead Letter Queue (DLQ)
          await this.sendToDlq(event, subscriber.name, err.message);
        }
      }
    }

    const durationSeconds = (Date.now() - startTime) / 1000;

    if (success) {
      // Mark as processed in Redis for idempotency
      if (this.redisService) {
        await this.redisService.set(idempotencyKey, 'true', IDEMPOTENCY_TTL_SECONDS);
      }

      if (this.metricsService) {
        this.metricsService.eventsConsumedTotal.inc({
          type: String(event.type),
          subscriber: subscriber.name,
        });
        this.metricsService.eventProcessingDurationSeconds.observe(
          { type: String(event.type), subscriber: subscriber.name },
          durationSeconds,
        );
      }

      this.logger.log(
        JSON.stringify({
          message: 'Event consumed successfully',
          subscriberName: subscriber.name,
          eventId: event.eventId,
          eventType: event.type,
          correlationId: event.correlationId,
          durationSeconds,
        }),
      );
    }
  }

  /**
   * Stores failed event payload in Redis Dead Letter Queue.
   */
  private async sendToDlq(event: BaseEvent, subscriberName: string, errorMessage: string): Promise<void> {
    const dlqKey = `${DLQ_PREFIX}${event.type}:${event.eventId}`;
    const dlqPayload = {
      event,
      subscriberName,
      failedAt: new Date().toISOString(),
      error: errorMessage,
    };

    if (this.redisService) {
      try {
        await this.redisService.set(dlqKey, JSON.stringify(dlqPayload), 604800); // 7 days retention
      } catch (err: any) {
        this.logger.error(`Failed to write to Redis DLQ: ${err.message}`);
      }
    }

    if (this.metricsService) {
      this.metricsService.eventsDlqTotal.inc({ type: String(event.type) });
    }
  }
}
