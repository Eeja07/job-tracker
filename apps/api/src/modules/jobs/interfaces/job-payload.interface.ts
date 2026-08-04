export interface WelcomeEmailPayload {
  userId: string;
  email: string;
  fullName: string;
}

export interface VirusScanPayload {
  attachmentId: string;
  fileKey: string;
  mimeType: string;
}

export interface CleanupStoragePayload {
  olderThanDays: number;
  directory?: string;
}

export interface GenerateReportPayload {
  userId: string;
  reportType: 'WEEKLY' | 'MONTHLY';
}

export interface DeadLetterPayload {
  originalQueue: string;
  jobName: string;
  jobId?: string;
  data: any;
  failedReason: string;
  attemptsMade: number;
  timestamp: string;
}
