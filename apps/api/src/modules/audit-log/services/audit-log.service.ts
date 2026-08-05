import { Injectable, Logger } from '@nestjs/common';
import { AuditLog } from '@prisma/client';
import {
  AuditLogRepository,
  CreateAuditLogData,
  AuditLogSearchOptions,
} from '../../../repositories/audit-log/audit-log.repository';
import { QueueService } from '../../jobs/services/queue.service';
import { QUEUE_NAMES, AuditJobName } from '../../jobs/constants/jobs.constants';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly queueService: QueueService,
  ) {}

  async recordEvent(data: CreateAuditLogData): Promise<AuditLog | void> {
    try {
      const isHealthy = await this.queueService.checkHealth();
      if (isHealthy) {
        await this.queueService.enqueue(
          QUEUE_NAMES.AUDIT,
          AuditJobName.RECORD_AUDIT_LOG,
          data,
        );
        return;
      }
      this.logger.warn(
        `Audit queue is unavailable. Falling back to synchronous audit log database insertion.`,
      );
      return await this.auditLogRepository.create(data);
    } catch (error: any) {
      this.logger.warn(
        `Failed to enqueue audit log job (${error.message}). Falling back to synchronous database insertion.`,
      );
      return await this.auditLogRepository.create(data);
    }
  }

  async recordDirect(data: CreateAuditLogData): Promise<AuditLog> {
    return this.auditLogRepository.create(data);
  }

  async findByUser(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ logs: AuditLog[]; total: number }> {
    return this.auditLogRepository.findByUser(userId, page, limit);
  }

  async getRecentLogs(limit = 10): Promise<AuditLog[]> {
    return this.auditLogRepository.findRecent(limit);
  }

  async searchLogs(
    options: AuditLogSearchOptions,
  ): Promise<{ logs: AuditLog[]; total: number }> {
    return this.auditLogRepository.search(options);
  }
}
