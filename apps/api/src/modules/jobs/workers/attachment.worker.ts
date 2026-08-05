import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { QUEUE_NAMES, AttachmentJobName } from '../constants/jobs.constants';
import { QueueService } from '../services/queue.service';
import { VirusScanPayload } from '../interfaces/job-payload.interface';

@Processor(QUEUE_NAMES.ATTACHMENT)
@Injectable()
export class AttachmentWorker extends WorkerHost {
  private readonly logger = new Logger(AttachmentWorker.name);

  constructor(
    @Inject(forwardRef(() => QueueService))
    private readonly queueService: QueueService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    this.logger.log(
      `Processing attachment job [${job.name}] (ID: ${job.id}, Attempt: ${job.attemptsMade + 1}/${job.opts.attempts || 5})`,
    );

    switch (job.name) {
      case AttachmentJobName.SCAN_ATTACHMENT:
        return this.handleVirusScan(job.data as VirusScanPayload);
      case AttachmentJobName.PROCESS_THUMBNAIL:
        this.logger.log(`Executing attachment processing [${job.name}]`);
        return { status: 'processed', jobName: job.name };
      default:
        this.logger.warn(`Unknown attachment job name [${job.name}]`);
        return { status: 'ignored', jobName: job.name };
    }
  }

  private async handleVirusScan(
    payload: VirusScanPayload,
  ): Promise<{ clean: boolean; attachmentId: string }> {
    this.logger.log(
      `[Infrastructure Demo] Virus scan completed for attachment ${payload.attachmentId} (${payload.fileKey})`,
    );
    return { clean: true, attachmentId: payload.attachmentId };
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error) {
    const maxAttempts = job.opts.attempts || 5;
    this.logger.error(
      `Job [${job.name}] (ID: ${job.id}) in queue [${QUEUE_NAMES.ATTACHMENT}] failed on attempt ${job.attemptsMade}/${maxAttempts}: ${error.message}`,
    );

    if (job.attemptsMade >= maxAttempts) {
      await this.queueService.moveToDeadLetterQueue({
        originalQueue: QUEUE_NAMES.ATTACHMENT,
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
