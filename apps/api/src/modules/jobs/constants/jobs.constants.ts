export const QUEUE_NAMES = {
  EMAIL: 'email',
  ATTACHMENT: 'attachment',
  NOTIFICATION: 'notification',
  SYSTEM: 'system',
  DEAD_LETTER: 'dead-letter',
  AUDIT: 'audit',
  JOB_CHECK: 'job-check',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export enum EmailJobName {
  SEND_WELCOME_EMAIL = 'SEND_WELCOME_EMAIL',
  SEND_PASSWORD_RESET = 'SEND_PASSWORD_RESET',
  SEND_APPLICATION_UPDATE = 'SEND_APPLICATION_UPDATE',
}

export enum AttachmentJobName {
  SCAN_ATTACHMENT = 'SCAN_ATTACHMENT',
  PROCESS_THUMBNAIL = 'PROCESS_THUMBNAIL',
}

export enum NotificationJobName {
  SEND_STAGE_CHANGE_ALERT = 'SEND_STAGE_CHANGE_ALERT',
  SEND_INTERVIEW_REMINDER = 'SEND_INTERVIEW_REMINDER',
}

export enum SystemJobName {
  CLEANUP_TEMP_FILES = 'CLEANUP_TEMP_FILES',
  GENERATE_WEEKLY_REPORT = 'GENERATE_WEEKLY_REPORT',
}

export enum DeadLetterJobName {
  PROCESS_DEAD_LETTER = 'PROCESS_DEAD_LETTER',
}

export enum AuditJobName {
  RECORD_AUDIT_LOG = 'RECORD_AUDIT_LOG',
}

export enum JobCheckJobName {
  CHECK_SINGLE_LISTING = 'CHECK_SINGLE_LISTING',
  CHECK_ALL_LISTINGS = 'CHECK_ALL_LISTINGS',
}
