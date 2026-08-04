import { EventType } from './event-type.enum';

export enum EventChannel {
  USER = 'events:user',
  APPLICATION = 'events:application',
  ATTACHMENT = 'events:attachment',
  COMPANY = 'events:company',
  AUDIT = 'events:audit',
  SYSTEM = 'events:system',
}

export function getChannelForEventType(type: EventType | string): EventChannel {
  switch (type) {
    case EventType.USER_REGISTERED:
    case EventType.ROLE_ASSIGNED:
    case EventType.ROLE_REMOVED:
      return EventChannel.USER;

    case EventType.APPLICATION_CREATED:
    case EventType.APPLICATION_UPDATED:
    case EventType.APPLICATION_STATUS_CHANGED:
      return EventChannel.APPLICATION;

    case EventType.ATTACHMENT_UPLOADED:
    case EventType.ATTACHMENT_DELETED:
      return EventChannel.ATTACHMENT;

    case EventType.COMPANY_CREATED:
    case EventType.COMPANY_DELETED:
      return EventChannel.COMPANY;

    case EventType.AUDIT_CREATED:
      return EventChannel.AUDIT;

    case EventType.FEATURE_FLAG_UPDATED:
    case EventType.EMAIL_SENT:
    case EventType.JOB_COMPLETED:
    case EventType.JOB_FAILED:
    default:
      return EventChannel.SYSTEM;
  }
}
