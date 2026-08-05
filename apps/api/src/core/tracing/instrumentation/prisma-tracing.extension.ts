import { Injectable, Logger } from '@nestjs/common';
import { TracingService } from '../services/tracing.service';
import { TraceContextService } from '../services/trace-context.service';
import { SPAN_NAMES } from '../constants/tracing.constants';

@Injectable()
export class PrismaTracingExtension {
  constructor(
    private readonly tracingService: TracingService,
    private readonly contextService: TraceContextService,
  ) {}

  /**
   * Wrap a Prisma operation in a prisma.query span.
   */
  async traceQuery<T>(
    model: string,
    action: string,
    queryFn: () => Promise<T>,
  ): Promise<T> {
    return this.tracingService.trace(
      SPAN_NAMES.PRISMA_QUERY,
      async (span) => {
        span.attributes['db.system'] = 'postgresql';
        span.attributes['db.prisma.model'] = model;
        span.attributes['db.prisma.action'] = action;
        return await queryFn();
      },
      {
        'db.operation': `${model}.${action}`,
      },
    );
  }
}
