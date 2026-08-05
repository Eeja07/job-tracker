import {
  Injectable,
  Logger,
  OnModuleDestroy,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job, JobsOptions } from 'bullmq';
import { QUEUE_NAMES, QueueName } from '../constants/jobs.constants';
import { DeadLetterPayload } from '../interfaces/job-payload.interface';

export interface QueueJobCounts {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
}

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: {
    count: 1000,
    age: 86400,
  },
  removeOnFail: false,
};

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues: Map<string, Queue>;

  constructor(
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ATTACHMENT)
    private readonly attachmentQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATION)
    private readonly notificationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SYSTEM) private readonly systemQueue: Queue,
    @InjectQueue(QUEUE_NAMES.DEAD_LETTER)
    private readonly deadLetterQueue: Queue,
  ) {
    this.queues = new Map<string, Queue>([
      [QUEUE_NAMES.EMAIL, this.emailQueue],
      [QUEUE_NAMES.ATTACHMENT, this.attachmentQueue],
      [QUEUE_NAMES.NOTIFICATION, this.notificationQueue],
      [QUEUE_NAMES.SYSTEM, this.systemQueue],
      [QUEUE_NAMES.DEAD_LETTER, this.deadLetterQueue],
    ]);
  }

  async onModuleDestroy() {
    this.logger.log('Draining and closing all BullMQ queues...');
    for (const [name, queue] of this.queues.entries()) {
      try {
        await queue.close();
        this.logger.log(`Closed queue [${name}]`);
      } catch (err: any) {
        this.logger.warn(`Error closing queue [${name}]: ${err.message}`);
      }
    }
  }

  private getQueue(queueName: string): Queue {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new NotFoundException(`Queue '${queueName}' is not registered`);
    }
    return queue;
  }

  async enqueue<T = any>(
    queueName: string,
    jobName: string,
    data: T,
    opts?: JobsOptions,
  ): Promise<Job<T>> {
    const queue = this.getQueue(queueName);
    const mergedOpts = { ...DEFAULT_JOB_OPTIONS, ...opts };
    const job = await queue.add(jobName, data, mergedOpts);
    this.logger.log(
      `Enqueued job [${jobName}] (ID: ${job.id}) in queue [${queueName}]`,
    );
    return job;
  }

  async enqueueDelayed<T = any>(
    queueName: string,
    jobName: string,
    data: T,
    delayMs: number,
    opts?: JobsOptions,
  ): Promise<Job<T>> {
    return this.enqueue(queueName, jobName, data, { ...opts, delay: delayMs });
  }

  async enqueueRepeatable<T = any>(
    queueName: string,
    jobName: string,
    data: T,
    cron: string,
    opts?: JobsOptions,
  ): Promise<Job<T>> {
    return this.enqueue(queueName, jobName, data, {
      ...opts,
      repeat: { pattern: cron },
    });
  }

  async remove(queueName: string, jobId: string): Promise<void> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
      this.logger.log(`Removed job [${jobId}] from queue [${queueName}]`);
    }
  }

  async getJob<T = any>(
    queueName: string,
    jobId: string,
  ): Promise<Job<T> | null> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    return (job as Job<T>) || null;
  }

  async moveToDeadLetterQueue(
    payload: DeadLetterPayload,
  ): Promise<Job<DeadLetterPayload>> {
    this.logger.warn(
      `Moving failed job [${payload.jobName}] from queue [${payload.originalQueue}] to Dead Letter Queue`,
    );
    return this.enqueue<DeadLetterPayload>(
      QUEUE_NAMES.DEAD_LETTER,
      'PROCESS_DEAD_LETTER',
      payload,
      { attempts: 1 },
    );
  }

  async getQueueMetrics(queueName: string): Promise<QueueJobCounts> {
    const defaultCounts = {
      waiting: 0,
      active: 0,
      delayed: 0,
      completed: 0,
      failed: 0,
    };
    try {
      const queue = this.getQueue(queueName);
      const fetchPromise = queue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'completed',
        'failed',
      );
      const timeoutPromise = new Promise<Record<string, number>>((resolve) =>
        setTimeout(() => resolve(defaultCounts), 500),
      );
      const counts = await Promise.race([fetchPromise, timeoutPromise]);
      return {
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        delayed: counts.delayed || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
      };
    } catch {
      return defaultCounts;
    }
  }

  async getAllMetrics(): Promise<Record<string, QueueJobCounts>> {
    const result: Record<string, QueueJobCounts> = {};
    const queueEntries = Array.from(this.queues.entries());

    const metricsPromises = queueEntries.map(async ([name]) => {
      const counts = await this.getQueueMetrics(name);
      return { name, counts };
    });

    const metricsResults = await Promise.all(metricsPromises);
    for (const { name, counts } of metricsResults) {
      result[name] = counts;
    }
    return result;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const pingPromise = (async () => {
        for (const queue of this.queues.values()) {
          const client = await queue.client;
          const status = await (client as any).ping();
          if (status !== 'PONG') {
            return false;
          }
        }
        return true;
      })();

      const timeoutPromise = new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), 500),
      );

      return await Promise.race([pingPromise, timeoutPromise]);
    } catch (err: any) {
      this.logger.warn(`Queue health check failed: ${err.message}`);
      return false;
    }
  }
}
