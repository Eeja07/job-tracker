import { Injectable } from '@nestjs/common';
import { TracingService } from '../services/tracing.service';
import { SPAN_NAMES } from '../constants/tracing.constants';

@Injectable()
export class RedisTracing {
  constructor(private readonly tracingService: TracingService) {}

  /**
   * Wrap a Redis command in a redis.command span.
   */
  async traceCommand<T>(
    command: string,
    args: any[],
    fn: () => Promise<T>,
  ): Promise<T> {
    const key =
      args.length > 0 && typeof args[0] === 'string' ? args[0] : 'unknown';
    return this.tracingService.trace(
      SPAN_NAMES.REDIS_COMMAND,
      async (span) => {
        span.attributes['db.system'] = 'redis';
        span.attributes['db.redis.command'] = command;
        span.attributes['db.redis.key'] = key;
        return await fn();
      },
      {
        'db.operation': command,
      },
    );
  }
}
