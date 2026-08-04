import { Processor as BullProcessor, WorkerHost as BullWorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { QUEUE_NAMES } from '../constants/jobs.constants';
import { QueueService } from '../services/queue.service';
import { AuditLogRepository } from '../../../repositories/audit-log/audit-log.repository';
import { MetricsService } from '../../../core/metrics/metrics.service';

@BullProcessor(QUEUE_NAMES.AUDIT)
@Injectable()
export class AuditWorker extends BullWorkerHost {
  private readonly logger = new Logger(AuditWorker.name);

  constructor(
    @Inject(forwardRef(() => QueueService))
    private readonly queueService: QueueService,
    private readonly auditLogRepository: AuditLogRepository,
    @Optional() private readonly metricsService?: MetricsService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    this.logger.log(
      `Processing audit log job [${job.name}] (ID: ${job.id}, Action: ${job.data?.action}, Resource: ${job.data?.resource})`,
    );

    const createdLog = await this.auditLogRepository.create(job.data);

    if (this.metricsService) {
      this.metricsService.auditLogsTotal.inc({ resource: job.data?.resource || 'unknown', action: job.data?.action || 'unknown' });
    }

    return createdLog;
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error) {
    const maxAttempts = job.opts.attempts || 5;
    this.logger.error(
      `Audit log job [${job.name}] (ID: ${job.id}) in queue [${QUEUE_NAMES.AUDIT}] failed on attempt ${job.attemptsMade}/${maxAttempts}: ${error.message}`,
    );

    if (this.metricsService) {
      this.metricsService.auditLogsFailedTotal.inc({ resource: job.data?.resource || 'unknown', action: job.data?.action || 'unknown' });
    }

    if (job.attemptsMade >= maxAttempts) {
      this.logger.error(
        `Audit log job [${job.name}] (ID: ${job.id}) exhausted all ${maxAttempts} retry attempts. Moving to Dead Letter Queue.`,
      );
      await this.queueService.moveToDeadLetterQueue({
        originalQueue: QUEUE_NAMES.AUDIT,
        jobName: job.name,
        jobId: job.id,
        data: job.data,
        failedReason: error.message,
        attemptsMade: job.attemptsMade,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
