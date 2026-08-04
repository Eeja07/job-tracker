import { Injectable, Logger, Optional } from '@nestjs/common';
import { IEventSubscriber } from '../interfaces/event-subscriber.interface';
import { BaseEvent } from '../interfaces/base-event.interface';
import { EventType } from '../enums/event-type.enum';
import { EmailService } from '../../email/services/email.service';

@Injectable()
export class EmailSubscriber implements IEventSubscriber {
  readonly name = 'EmailSubscriber';
  readonly subscribedEvents = [
    EventType.USER_REGISTERED,
    EventType.APPLICATION_STATUS_CHANGED,
    EventType.EMAIL_SENT,
  ];

  private readonly logger = new Logger(EmailSubscriber.name);

  constructor(@Optional() private readonly emailService?: EmailService) {}

  async handle(event: BaseEvent): Promise<void> {
    this.logger.log(
      JSON.stringify({
        message: 'EmailSubscriber processing event',
        eventId: event.eventId,
        eventType: event.type,
        correlationId: event.correlationId,
      }),
    );

    if (event.type === EventType.USER_REGISTERED && this.emailService) {
      try {
        await this.emailService.sendTemplate({
          to: event.payload.email,
          subject: 'Welcome to Job Tracker',
          templateName: 'welcome',
          context: { name: event.payload.fullName },
        });
      } catch (err: any) {
        this.logger.warn(`EmailSubscriber welcome email dispatch failed: ${err.message}`);
      }
    }
  }
}
