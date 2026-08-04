import { Injectable, Logger, Optional } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';

@Injectable()
export class CqrsMetricsService {
  private readonly logger = new Logger(CqrsMetricsService.name);

  public readonly projectionUpdatesTotal: Counter<string>;
  public readonly projectionFailuresTotal: Counter<string>;
  public readonly projectionLatencySeconds: Histogram<string>;
  public readonly queryCacheHitsTotal: Counter<string>;
  public readonly queryCacheMissesTotal: Counter<string>;
  public readonly commandExecutionTotal: Counter<string>;
  public readonly queryExecutionTotal: Counter<string>;
  public readonly projectionRebuildTotal: Counter<string>;
  public readonly projectionRebuildDurationSeconds: Histogram<string>;
  public readonly projectionRecordsProcessedTotal: Counter<string>;
  public readonly projectionBatchesTotal: Counter<string>;

  constructor(@Optional() private readonly registry?: Registry) {
    const reg = this.registry || new Registry();

    this.projectionUpdatesTotal = new Counter({
      name: 'projection_updates_total',
      help: 'Total number of projection updates',
      labelNames: ['projection', 'status'],
      registers: [reg],
    });

    this.projectionFailuresTotal = new Counter({
      name: 'projection_failures_total',
      help: 'Total number of projection processing failures',
      labelNames: ['projection', 'reason'],
      registers: [reg],
    });

    this.projectionLatencySeconds = new Histogram({
      name: 'projection_latency_seconds',
      help: 'Projection processing latency in seconds',
      labelNames: ['projection'],
      buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2.5, 5],
      registers: [reg],
    });

    this.queryCacheHitsTotal = new Counter({
      name: 'query_cache_hits_total',
      help: 'Total query cache hits',
      labelNames: ['query'],
      registers: [reg],
    });

    this.queryCacheMissesTotal = new Counter({
      name: 'query_cache_misses_total',
      help: 'Total query cache misses',
      labelNames: ['query'],
      registers: [reg],
    });

    this.commandExecutionTotal = new Counter({
      name: 'command_execution_total',
      help: 'Total command executions',
      labelNames: ['command', 'status'],
      registers: [reg],
    });

    this.queryExecutionTotal = new Counter({
      name: 'query_execution_total',
      help: 'Total query executions',
      labelNames: ['query', 'status'],
      registers: [reg],
    });

    this.projectionRebuildTotal = new Counter({
      name: 'projection_rebuild_total',
      help: 'Total number of projection rebuild executions',
      labelNames: ['status'],
      registers: [reg],
    });

    this.projectionRebuildDurationSeconds = new Histogram({
      name: 'projection_rebuild_duration_seconds',
      help: 'Projection rebuild duration in seconds',
      buckets: [0.05, 0.1, 0.5, 1, 5, 10, 30, 60],
      registers: [reg],
    });

    this.projectionRecordsProcessedTotal = new Counter({
      name: 'projection_records_processed_total',
      help: 'Total records processed during projection rebuilds',
      labelNames: ['model'],
      registers: [reg],
    });

    this.projectionBatchesTotal = new Counter({
      name: 'projection_batches_total',
      help: 'Total batches processed during projection rebuilds',
      labelNames: ['model'],
      registers: [reg],
    });
  }
}
