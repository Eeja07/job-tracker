import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { QUEUE_NAMES, NotificationJobName } from '../constants/jobs.constants';
import { QueueService } from '../services/queue.service';

@Processor(QUEUE_NAMES.NOTIFICATION)
@Injectable()
export class NotificationWorker extends WorkerHost {
  private readonly logger = new Logger(NotificationWorker.name);

  constructor(
    @Inject(forwardRef(() => QueueService))
    private readonly queueService: QueueService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    this.logger.log(
      `Processing notification job [${job.name}] (ID: ${job.id}, Attempt: ${job.attemptsMade + 1}/${job.opts.attempts || 5})`,
    );

    switch (job.name) {
      case NotificationJobName.SEND_STAGE_CHANGE_ALERT:
      case NotificationJobName.SEND_INTERVIEW_REMINDER:
        this.logger.log(`Executing notification job [${job.name}]`);
        return { status: 'processed', jobName: job.name };
      default:
        this.logger.warn(`Unknown notification job name [${job.name}]`);
        return { status: 'ignored', jobName: job.name };
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error) {
    const maxAttempts = job.opts.attempts || 5;
    this.logger.error(
      `Job [${job.name}] (ID: ${job.id}) in queue [${QUEUE_NAMES.NOTIFICATION}] failed on attempt ${job.attemptsMade}/${maxAttempts}: ${error.message}`,
    );

    if (job.attemptsMade >= maxAttempts) {
      await this.queueService.moveToDeadLetterQueue({
        originalQueue: QUEUE_NAMES.NOTIFICATION,
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
