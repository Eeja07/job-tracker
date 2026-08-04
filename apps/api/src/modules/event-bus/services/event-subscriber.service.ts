import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from '../../redis/redis.service';
import { MetricsService } from '../../../core/metrics/metrics.service';
import { BaseEvent } from '../interfaces/base-event.interface';
import { IEventSubscriber } from '../interfaces/event-subscriber.interface';
import { EventChannel } from '../enums/event-channel.enum';

const MAX_RETRIES = 3;
const IDEMPOTENCY_TTL_SECONDS = 86400; // 24 hours
const DLQ_PREFIX = 'events:dlq:';
const PROCESSED_PREFIX = 'events:processed:';
const CONSUMER_GROUP_NAME = 'job-tracker-subscribers';

@Injectable()
export class EventSubscriberService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventSubscriberService.name);
  private readonly subscribers: IEventSubscriber[] = [];
  private isConsumingStreams = true;

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

    // Setup Redis Streams Consumer Group for horizontal multi-node scaling
    try {
      const client = this.redisService.getClient?.();
      if (client && typeof client.xgroup === 'function') {
        const consumerId = `consumer-${randomUUID()}`;

        for (const channel of channels) {
          try {
            await client.xgroup('CREATE', channel, CONSUMER_GROUP_NAME, '$', 'MKSTREAM');
          } catch (err: any) {
            // Ignore BUSYGROUP error if consumer group already exists
          }
        }

        // Start background Redis Streams consumer loop (non-test environments)
        if (process.env.NODE_ENV !== 'test') {
          this.startStreamConsumerLoop(CONSUMER_GROUP_NAME, consumerId, channels).catch((err) => {
            this.logger.warn(`Stream consumer loop error: ${err.message}`);
          });
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to initialize Redis Streams consumer groups: ${err.message}`);
    }

    for (const channel of channels) {
      await this.redisService.subscribe(channel, (message: string) => {
        // Asynchronously process incoming Redis events without blocking
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

  onModuleDestroy(): void {
    this.isConsumingStreams = false;
  }

  /**
   * Background Redis Streams Consumer Group reader loop.
   */
  private async startStreamConsumerLoop(groupName: string, consumerId: string, channels: string[]): Promise<void> {
    const client = this.redisService?.getClient();
    if (!client || typeof client.xreadgroup !== 'function') return;

    while (this.isConsumingStreams) {
      try {
        const streamArgs: string[] = [];
        const idArgs: string[] = [];
        for (const channel of channels) {
          streamArgs.push(channel);
          idArgs.push('>');
        }

        const results: any = await (client as any).xreadgroup(
          'GROUP',
          groupName,
          consumerId,
          'BLOCK',
          1000,
          'COUNT',
          10,
          'STREAMS',
          ...streamArgs,
          ...idArgs,
        );

        if (results && Array.isArray(results)) {
          for (const [streamChannel, messages] of results) {
            if (!Array.isArray(messages)) continue;
            for (const [messageId, fields] of messages) {
              let payloadStr = '';
              if (Array.isArray(fields)) {
                for (let i = 0; i < fields.length; i += 2) {
                  if (fields[i] === 'event') {
                    payloadStr = fields[i + 1];
                    break;
                  }
                }
              }
              if (payloadStr) {
                await this.processIncomingMessage(streamChannel, payloadStr);
              }
              await client.xack(streamChannel, groupName, messageId);
            }
          }
        }
      } catch (err: any) {
        if (this.isConsumingStreams) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
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
   * Dispatches event to a single subscriber with atomic claim idempotency, retries, and DLQ handling.
   */
  async dispatchToSubscriber(subscriber: IEventSubscriber, event: BaseEvent): Promise<void> {
    const idempotencyKey = `${PROCESSED_PREFIX}${subscriber.name}:${event.eventId}`;

    // 1. Atomic Claim Idempotency Check (SET key value NX EX ttl)
    if (this.redisService && this.redisService.isReady()) {
      let isClaimed = false;
      if (typeof this.redisService.acquireLock === 'function') {
        const token = await this.redisService.acquireLock(idempotencyKey, IDEMPOTENCY_TTL_SECONDS);
        isClaimed = token !== null;
      } else if (typeof this.redisService.exists === 'function') {
        const exists = await this.redisService.exists(idempotencyKey);
        isClaimed = !exists;
      } else {
        isClaimed = true;
      }

      if (!isClaimed) {
        // If claimed by concurrent execution, wait briefly for in-flight handler to complete
        if (typeof this.redisService.get === 'function') {
          for (let i = 0; i < 20; i++) {
            const val = await this.redisService.get(idempotencyKey);
            if (val === 'PROCESSED' || val === 'completed') break;
            await new Promise((res) => setTimeout(res, 25));
          }
        }
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
      if (this.redisService) {
        await this.redisService.set(idempotencyKey, 'PROCESSED', IDEMPOTENCY_TTL_SECONDS);
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

