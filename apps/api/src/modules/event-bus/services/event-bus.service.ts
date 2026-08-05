import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import {
  EventPublisherService,
  EventPublishInput,
} from './event-publisher.service';
import { EventSubscriberService } from './event-subscriber.service';
import { BaseEvent } from '../interfaces/base-event.interface';
import { AuditSubscriber } from '../subscribers/audit.subscriber';
import { EmailSubscriber } from '../subscribers/email.subscriber';
import { MetricsSubscriber } from '../subscribers/metrics.subscriber';
import { NotificationSubscriber } from '../subscribers/notification.subscriber';
import { WebsocketSubscriber } from '../subscribers/websocket.subscriber';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class EventBusService implements OnModuleInit {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    private readonly publisher: EventPublisherService,
    private readonly subscriberService: EventSubscriberService,
    private readonly auditSubscriber: AuditSubscriber,
    private readonly emailSubscriber: EmailSubscriber,
    private readonly metricsSubscriber: MetricsSubscriber,
    private readonly notificationSubscriber: NotificationSubscriber,
    private readonly websocketSubscriber: WebsocketSubscriber,
    @Optional() private readonly redisService?: RedisService,
  ) {}

  onModuleInit(): void {
    // Automatically register standard subscribers
    this.subscriberService.registerSubscriber(this.auditSubscriber);
    this.subscriberService.registerSubscriber(this.emailSubscriber);
    this.subscriberService.registerSubscriber(this.metricsSubscriber);
    this.subscriberService.registerSubscriber(this.notificationSubscriber);
    this.subscriberService.registerSubscriber(this.websocketSubscriber);

    this.logger.log(
      'EventBusService initialized and registered standard subscribers',
    );
  }

  /**
   * Publishes an event to the Event Bus
   */
  async publish<T extends BaseEvent>(input: EventPublishInput<T>): Promise<T> {
    return this.publisher.publish(input);
  }

  /**
   * Health status check for Event Bus components
   */
  isReady(): boolean {
    return this.redisService ? this.redisService.isReady() : true;
  }
}
