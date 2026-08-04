import { Injectable, Logger, Optional } from '@nestjs/common';
import { Counter, Gauge, Registry } from 'prom-client';

@Injectable()
export class TracingMetricsService {
  private readonly logger = new Logger(TracingMetricsService.name);

  public readonly traceExportTotal: Counter<string>;
  public readonly traceExportFailures: Counter<string>;
  public readonly traceSamplingTotal: Counter<string>;
  public readonly activeSpans: Gauge<string>;

  constructor(@Optional() private readonly registry?: Registry) {
    const reg = this.registry || new Registry();

    this.traceExportTotal = new Counter({
      name: 'trace_export_total',
      help: 'Total number of traces/spans exported',
      labelNames: ['exporter'],
      registers: [reg],
    });

    this.traceExportFailures = new Counter({
      name: 'trace_export_failures',
      help: 'Total number of trace export failures',
      labelNames: ['exporter', 'reason'],
      registers: [reg],
    });

    this.traceSamplingTotal = new Counter({
      name: 'trace_sampling_total',
      help: 'Total number of trace sampling decisions made',
      labelNames: ['decision'], // sampled | dropped
      registers: [reg],
    });

    this.activeSpans = new Gauge({
      name: 'active_spans',
      help: 'Current number of active in-flight spans',
      registers: [reg],
    });
  }
}
