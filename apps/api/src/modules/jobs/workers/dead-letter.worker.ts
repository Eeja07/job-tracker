import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '../constants/jobs.constants';
import { DeadLetterPayload } from '../interfaces/job-payload.interface';

@Processor(QUEUE_NAMES.DEAD_LETTER)
@Injectable()
export class DeadLetterWorker extends WorkerHost {
  private readonly logger = new Logger(DeadLetterWorker.name);

  async process(job: Job<DeadLetterPayload>): Promise<any> {
    const data = job.data;
    this.logger.error(
      `[DLQ PROCESSOR] Job [${data.jobName}] originally from queue [${data.originalQueue}] (Failed Reason: ${data.failedReason}) stored in Dead Letter Queue for audit/replay`,
    );

    return {
      status: 'dlq_recorded',
      originalQueue: data.originalQueue,
      jobName: data.jobName,
      timestamp: data.timestamp,
    };
  }
}
