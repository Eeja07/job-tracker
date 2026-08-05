import { Injectable, Logger } from '@nestjs/common';
import { IQuery, IQueryHandler } from '../interfaces/query.interface';
import { CqrsMetricsService } from './cqrs-metrics.service';
import { TraceContextService } from '../../tracing/services/trace-context.service';

@Injectable()
export class QueryBus {
  private readonly logger = new Logger(QueryBus.name);
  private readonly handlers = new Map<string, IQueryHandler>();

  constructor(
    private readonly metricsService: CqrsMetricsService,
    private readonly traceContextService?: TraceContextService,
  ) {}

  registerHandler(handler: IQueryHandler): void {
    this.handlers.set(handler.queryName, handler);
    this.logger.log(`Registered query handler: ${handler.queryName}`);
  }

  async execute<TQuery extends IQuery = any, TResult = any>(
    query: TQuery,
  ): Promise<TResult> {
    const queryName = query.queryName;
    const handler = this.handlers.get(queryName);

    const traceId =
      query.traceId || this.traceContextService?.getTraceId() || 'unknown';
    const correlationId =
      query.correlationId ||
      this.traceContextService?.getCorrelationId() ||
      'unknown';

    if (!handler) {
      this.logger.error(
        JSON.stringify({
          message: `Query handler not found for: ${queryName}`,
          queryName,
          traceId,
          correlationId,
        }),
      );
      this.metricsService.queryExecutionTotal.inc({
        query: queryName,
        status: 'not_found',
      });
      throw new Error(`Query handler not found for: ${queryName}`);
    }

    const startTime = Date.now();

    this.logger.log(
      JSON.stringify({
        message: 'Executing query',
        queryName,
        traceId,
        correlationId,
        userId: query.userId,
      }),
    );

    try {
      const result = await handler.execute(query);
      this.metricsService.queryExecutionTotal.inc({
        query: queryName,
        status: 'success',
      });
      return result;
    } catch (err: any) {
      this.logger.error(
        JSON.stringify({
          message: 'Query execution failed',
          queryName,
          traceId,
          correlationId,
          error: err.message,
          durationMs: Date.now() - startTime,
        }),
      );
      this.metricsService.queryExecutionTotal.inc({
        query: queryName,
        status: 'failure',
      });
      throw err;
    }
  }

  getRegisteredHandlers(): string[] {
    return Array.from(this.handlers.keys());
  }
}
