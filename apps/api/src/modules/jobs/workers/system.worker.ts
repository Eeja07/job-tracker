import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { QUEUE_NAMES, SystemJobName } from '../constants/jobs.constants';
import { QueueService } from '../services/queue.service';
import {
  CleanupStoragePayload,
  GenerateReportPayload,
} from '../interfaces/job-payload.interface';

@Processor(QUEUE_NAMES.SYSTEM)
@Injectable()
export class SystemWorker extends WorkerHost {
  private readonly logger = new Logger(SystemWorker.name);

  constructor(
    @Inject(forwardRef(() => QueueService))
    private readonly queueService: QueueService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    this.logger.log(
      `Processing system job [${job.name}] (ID: ${job.id}, Attempt: ${job.attemptsMade + 1}/${job.opts.attempts || 5})`,
    );

    switch (job.name) {
      case SystemJobName.CLEANUP_TEMP_FILES:
        return this.handleCleanupTempFiles(job.data as CleanupStoragePayload);
      case SystemJobName.GENERATE_WEEKLY_REPORT:
        return this.handleGenerateWeeklyReport(
          job.data as GenerateReportPayload,
        );
      default:
        this.logger.warn(`Unknown system job name [${job.name}]`);
        return { status: 'ignored', jobName: job.name };
    }
  }

  private async handleCleanupTempFiles(
    payload: CleanupStoragePayload,
  ): Promise<{ status: string; olderThanDays: number }> {
    this.logger.log(
      `[Infrastructure Demo] Cleanup storage task executed for files older than ${payload.olderThanDays} days`,
    );
    return { status: 'completed', olderThanDays: payload.olderThanDays };
  }

  private async handleGenerateWeeklyReport(
    payload: GenerateReportPayload,
  ): Promise<{ status: string; userId: string }> {
    this.logger.log(
      `[Infrastructure Demo] Generated weekly report for user ${payload.userId}`,
    );
    return { status: 'completed', userId: payload.userId };
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error) {
    const maxAttempts = job.opts.attempts || 5;
    this.logger.error(
      `Job [${job.name}] (ID: ${job.id}) in queue [${QUEUE_NAMES.SYSTEM}] failed on attempt ${job.attemptsMade}/${maxAttempts}: ${error.message}`,
    );

    if (job.attemptsMade >= maxAttempts) {
      await this.queueService.moveToDeadLetterQueue({
        originalQueue: QUEUE_NAMES.SYSTEM,
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
