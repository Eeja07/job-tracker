import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { QUEUE_NAMES, JobCheckJobName } from '../constants/jobs.constants';
import { QueueService } from '../services/queue.service';
import { JobStatusCheckerService } from '../../applications/job-status-checker.service';

@Processor(QUEUE_NAMES.JOB_CHECK)
@Injectable()
export class JobCheckWorker extends WorkerHost {
  private readonly logger = new Logger(JobCheckWorker.name);

  constructor(
    @Inject(forwardRef(() => QueueService))
    private readonly queueService: QueueService,
    private readonly jobStatusChecker: JobStatusCheckerService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    this.logger.log(`Processing job-check [${job.name}] (ID: ${job.id})`);

    switch (job.name) {
      case JobCheckJobName.CHECK_SINGLE_LISTING:
        return this.jobStatusChecker.checkSingleListing(job.data.applicationId);
      case JobCheckJobName.CHECK_ALL_LISTINGS:
        return this.jobStatusChecker.checkAllActiveListings();
      default:
        this.logger.warn(`Unknown job-check name [${job.name}]`);
        return { status: 'ignored' };
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error) {
    this.logger.error(`Job-check [${job.name}] (ID: ${job.id}) failed: ${error.message}`);
  }
}
