import { BaseEvent } from './base-event.interface';
import { EventType } from '../enums/event-type.enum';

export interface UserRegisteredPayload {
  userId: string;
  email: string;
  fullName: string;
  role: string;
}
export interface UserRegisteredEvent extends BaseEvent<UserRegisteredPayload> {
  type: EventType.USER_REGISTERED;
}

export interface ApplicationCreatedPayload {
  applicationId: string;
  userId: string;
  companyId: string;
  title: string;
  status: string;
}
export interface ApplicationCreatedEvent extends BaseEvent<ApplicationCreatedPayload> {
  type: EventType.APPLICATION_CREATED;
}

export interface ApplicationUpdatedPayload {
  applicationId: string;
  userId: string;
  changes: Record<string, any>;
}
export interface ApplicationUpdatedEvent extends BaseEvent<ApplicationUpdatedPayload> {
  type: EventType.APPLICATION_UPDATED;
}

export interface ApplicationStatusChangedPayload {
  applicationId: string;
  userId: string;
  oldStatus: string;
  newStatus: string;
}
export interface ApplicationStatusChangedEvent extends BaseEvent<ApplicationStatusChangedPayload> {
  type: EventType.APPLICATION_STATUS_CHANGED;
}

export interface AttachmentUploadedPayload {
  attachmentId: string;
  applicationId: string;
  userId: string;
  fileName: string;
  fileKey: string;
  size: number;
}
export interface AttachmentUploadedEvent extends BaseEvent<AttachmentUploadedPayload> {
  type: EventType.ATTACHMENT_UPLOADED;
}

export interface AttachmentDeletedPayload {
  attachmentId: string;
  applicationId: string;
  userId: string;
  fileKey: string;
}
export interface AttachmentDeletedEvent extends BaseEvent<AttachmentDeletedPayload> {
  type: EventType.ATTACHMENT_DELETED;
}

export interface CompanyCreatedPayload {
  companyId: string;
  name: string;
  website?: string;
}
export interface CompanyCreatedEvent extends BaseEvent<CompanyCreatedPayload> {
  type: EventType.COMPANY_CREATED;
}

export interface CompanyDeletedPayload {
  companyId: string;
  name: string;
}
export interface CompanyDeletedEvent extends BaseEvent<CompanyDeletedPayload> {
  type: EventType.COMPANY_DELETED;
}

export interface AuditCreatedPayload {
  auditId: string;
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
}
export interface AuditCreatedEvent extends BaseEvent<AuditCreatedPayload> {
  type: EventType.AUDIT_CREATED;
}

export interface FeatureFlagUpdatedPayload {
  flagKey: string;
  enabled: boolean;
  rolloutPercentage: number;
}
export interface FeatureFlagUpdatedEvent extends BaseEvent<FeatureFlagUpdatedPayload> {
  type: EventType.FEATURE_FLAG_UPDATED;
}

export interface RoleAssignedPayload {
  userId: string;
  roleId: string;
  roleName: string;
}
export interface RoleAssignedEvent extends BaseEvent<RoleAssignedPayload> {
  type: EventType.ROLE_ASSIGNED;
}

export interface RoleRemovedPayload {
  userId: string;
  roleId: string;
  roleName: string;
}
export interface RoleRemovedEvent extends BaseEvent<RoleRemovedPayload> {
  type: EventType.ROLE_REMOVED;
}

export interface EmailSentPayload {
  recipient: string;
  template: string;
  subject: string;
  messageId?: string;
}
export interface EmailSentEvent extends BaseEvent<EmailSentPayload> {
  type: EventType.EMAIL_SENT;
}

export interface JobCompletedPayload {
  jobId: string;
  queueName: string;
  durationMs: number;
}
export interface JobCompletedEvent extends BaseEvent<JobCompletedPayload> {
  type: EventType.JOB_COMPLETED;
}

export interface JobFailedPayload {
  jobId: string;
  queueName: string;
  error: string;
  attempts: number;
}
export interface JobFailedEvent extends BaseEvent<JobFailedPayload> {
  type: EventType.JOB_FAILED;
}

export type DomainEvent =
  | UserRegisteredEvent
  | ApplicationCreatedEvent
  | ApplicationUpdatedEvent
  | ApplicationStatusChangedEvent
  | AttachmentUploadedEvent
  | AttachmentDeletedEvent
  | CompanyCreatedEvent
  | CompanyDeletedEvent
  | AuditCreatedEvent
  | FeatureFlagUpdatedEvent
  | RoleAssignedEvent
  | RoleRemovedEvent
  | EmailSentEvent
  | JobCompletedEvent
  | JobFailedEvent;
