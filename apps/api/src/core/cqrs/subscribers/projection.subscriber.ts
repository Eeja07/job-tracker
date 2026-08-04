import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { IEventSubscriber } from '../../../modules/event-bus/interfaces/event-subscriber.interface';
import { EventType } from '../../../modules/event-bus/enums/event-type.enum';
import { BaseEvent } from '../../../modules/event-bus/interfaces/base-event.interface';
import { EventSubscriberService } from '../../../modules/event-bus/services/event-subscriber.service';
import { ProjectionManager } from '../services/projection-manager.service';

@Injectable()
export class ProjectionSubscriber implements IEventSubscriber, OnModuleInit {
  readonly name = 'ProjectionSubscriber';
  readonly subscribedEvents: (EventType | string)[] = [
    EventType.APPLICATION_CREATED,
    EventType.APPLICATION_UPDATED,
    EventType.APPLICATION_STATUS_CHANGED,
    EventType.COMPANY_CREATED,
    EventType.COMPANY_DELETED,
    EventType.ATTACHMENT_UPLOADED,
    EventType.ATTACHMENT_DELETED,
    EventType.ROLE_ASSIGNED,
    EventType.ROLE_REMOVED,
    EventType.AUDIT_CREATED,
    EventType.FEATURE_FLAG_UPDATED,
  ];

  private readonly logger = new Logger(ProjectionSubscriber.name);

  constructor(
    private readonly projectionManager: ProjectionManager,
    @Optional() private readonly subscriberService?: EventSubscriberService,
  ) {}

  onModuleInit(): void {
    if (this.subscriberService) {
      this.subscriberService.registerSubscriber(this);
      this.logger.log('Registered ProjectionSubscriber with EventSubscriberService');
    }
  }

  async handle(event: BaseEvent): Promise<void> {
    this.logger.log(
      JSON.stringify({
        message: 'ProjectionSubscriber received event',
        eventType: event.type,
        eventId: event.eventId,
        correlationId: event.correlationId,
      }),
    );

    await this.projectionManager.processEvent(event);
  }
}
