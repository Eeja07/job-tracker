import { Injectable } from '@nestjs/common';
import { TracingService } from '../services/tracing.service';
import { SPAN_NAMES } from '../constants/tracing.constants';

@Injectable()
export class BullMQTracing {
  constructor(private readonly tracingService: TracingService) {}

  /**
   * Wrap a BullMQ job processing function in a bullmq.job span.
   */
  async traceJob<T>(queueName: string, jobName: string, jobId: string, fn: () => Promise<T>): Promise<T> {
    return this.tracingService.trace(
      SPAN_NAMES.BULLMQ_JOB,
      async (span) => {
        span.attributes['messaging.system'] = 'bullmq';
        span.attributes['messaging.destination'] = queueName;
        span.attributes['messaging.job_name'] = jobName;
        span.attributes['messaging.job_id'] = jobId;
        return await fn();
      },
      {
        'messaging.operation': 'process',
      },
    );
  }
}
