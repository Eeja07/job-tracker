import { Global, Module } from '@nestjs/common';
import { EventPublisherService } from './services/event-publisher.service';
import { EventSubscriberService } from './services/event-subscriber.service';
import { EventBusService } from './services/event-bus.service';
import { AuditSubscriber } from './subscribers/audit.subscriber';
import { EmailSubscriber } from './subscribers/email.subscriber';
import { MetricsSubscriber } from './subscribers/metrics.subscriber';
import { NotificationSubscriber } from './subscribers/notification.subscriber';
import { WebsocketSubscriber } from './subscribers/websocket.subscriber';
import { EmailModule } from '../email/email.module';
import { RepositoriesModule } from '../../repositories/repositories.module';

@Global()
@Module({
  imports: [EmailModule, RepositoriesModule],
  providers: [
    EventPublisherService,
    EventSubscriberService,
    EventBusService,
    AuditSubscriber,
    EmailSubscriber,
    MetricsSubscriber,
    NotificationSubscriber,
    WebsocketSubscriber,
  ],
  exports: [EventPublisherService, EventSubscriberService, EventBusService],
})
export class EventBusModule {}
