import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'crypto';
import {
  SENSITIVE_ATTRIBUTE_KEYS,
  SPAN_NAMES,
  TRACING_ENABLED_KEY,
  TRACING_EXPORTER_KEY,
  TRACING_SAMPLE_RATE_KEY,
} from '../constants/tracing.constants';
import {
  TraceContextService,
  TraceContextStore,
} from './trace-context.service';
import { TracingMetricsService } from './tracing-metrics.service';

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: 'OK' | 'ERROR';
  attributes: Record<string, any>;
  events: Array<{
    name: string;
    timestamp: number;
    attributes?: Record<string, any>;
  }>;
  error?: Error;
}

export type SamplerMode = 'AlwaysOn' | 'AlwaysOff' | 'TraceIdRatio';

@Injectable()
export class TracingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TracingService.name);
  private enabled = true;
  private exporterType = 'console'; // console | otlp | jaeger | none
  private sampleRate = 0.1; // Default 10%
  private samplerMode: SamplerMode = 'TraceIdRatio';
  private otlpExporterStatus: 'up' | 'down' = 'up';
  private jaegerExporterStatus: 'up' | 'down' = 'up';

  constructor(
    private readonly configService: ConfigService,
    private readonly contextService: TraceContextService,
    private readonly metrics: TracingMetricsService,
  ) {}

  onModuleInit(): void {
    const envEnabled = this.configService.get<string>(
      TRACING_ENABLED_KEY,
      'true',
    );
    this.enabled = envEnabled !== 'false' && envEnabled !== '0';

    this.exporterType = this.configService
      .get<string>(TRACING_EXPORTER_KEY, 'console')
      .toLowerCase();

    const sampleRateRaw = this.configService.get<string>(
      TRACING_SAMPLE_RATE_KEY,
      '0.1',
    );
    if (
      sampleRateRaw === '1' ||
      sampleRateRaw === '1.0' ||
      sampleRateRaw === 'always_on'
    ) {
      this.samplerMode = 'AlwaysOn';
      this.sampleRate = 1.0;
    } else if (
      sampleRateRaw === '0' ||
      sampleRateRaw === '0.0' ||
      sampleRateRaw === 'always_off'
    ) {
      this.samplerMode = 'AlwaysOff';
      this.sampleRate = 0.0;
    } else {
      this.samplerMode = 'TraceIdRatio';
      this.sampleRate = Math.max(
        0,
        Math.min(1, parseFloat(sampleRateRaw) || 0.1),
      );
    }

    this.logger.log(
      JSON.stringify({
        message: 'TracingService initialized',
        enabled: this.enabled,
        exporterType: this.exporterType,
        samplerMode: this.samplerMode,
        sampleRate: this.sampleRate,
      }),
    );
  }

  onModuleDestroy(): void {
    // Gracefully flush spans
  }

  /**
   * Determine if a trace should be sampled based on configured sampler.
   */
  shouldSample(traceId?: string): boolean {
    if (!this.enabled) {
      this.metrics.traceSamplingTotal.inc({ decision: 'dropped' });
      return false;
    }

    let sampled = false;
    if (this.samplerMode === 'AlwaysOn') {
      sampled = true;
    } else if (this.samplerMode === 'AlwaysOff') {
      sampled = false;
    } else {
      // Deterministic trace ID ratio sampling or random fallback
      if (traceId && traceId.length >= 8) {
        const hash = parseInt(traceId.substring(0, 8), 16);
        sampled = hash / 0xffffffff < this.sampleRate;
      } else {
        sampled = Math.random() < this.sampleRate;
      }
    }

    this.metrics.traceSamplingTotal.inc({
      decision: sampled ? 'sampled' : 'dropped',
    });
    return sampled;
  }

  /**
   * Generate 128-bit OTel hex traceId (32 hex chars).
   */
  generateTraceId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Generate 64-bit OTel hex spanId (16 hex chars).
   */
  generateSpanId(): string {
    return randomBytes(8).toString('hex');
  }

  /**
   * Start a new span manually.
   */
  startSpan(
    name: string,
    parentStore?: Partial<TraceContextStore>,
    initialAttributes: Record<string, any> = {},
  ): Span {
    const parentContext = parentStore || this.contextService.getStore();
    const traceId = parentContext?.traceId || this.generateTraceId();
    const parentSpanId = parentContext?.spanId;
    const spanId = this.generateSpanId();
    const sampled =
      parentContext?.sampled !== undefined
        ? parentContext.sampled
        : this.shouldSample(traceId);

    const attributes = this.sanitizeAttributes({
      ...parentContext?.attributes,
      ...initialAttributes,
    });

    this.metrics.activeSpans.inc();

    return {
      traceId,
      spanId,
      parentSpanId,
      name,
      startTime: Date.now(),
      status: 'OK',
      attributes,
      events: [],
    };
  }

  /**
   * Finish/End a span and export it.
   */
  endSpan(span: Span, error?: Error): void {
    span.endTime = Date.now();
    span.durationMs = span.endTime - span.startTime;

    if (error) {
      span.status = 'ERROR';
      span.error = error;
      span.attributes['error.type'] = error.name;
      span.attributes['error.message'] = error.message;
      span.attributes['error.stack'] = error.stack;
    }

    this.metrics.activeSpans.dec();

    const currentStore = this.contextService.getStore();
    const shouldExport =
      currentStore?.sampled !== undefined ? currentStore.sampled : true;

    if (shouldExport) {
      this.exportSpan(span);
    }
  }

  /**
   * Create and manage span execution wrapper for sync/async functions.
   */
  async trace<T>(
    name: string,
    fn: (span: Span) => Promise<T> | T,
    attributes: Record<string, any> = {},
  ): Promise<T> {
    const parent = this.contextService.getStore();
    const span = this.startSpan(name, parent, attributes);

    const childStore: TraceContextStore = {
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      requestId: parent?.requestId,
      correlationId: parent?.correlationId,
      userId: parent?.userId,
      sampled: parent?.sampled ?? this.shouldSample(span.traceId),
      attributes: span.attributes,
    };

    try {
      const result = await this.contextService.run(childStore, async () => {
        return await fn(span);
      });
      this.endSpan(span);
      return result;
    } catch (err: any) {
      this.endSpan(span, err);
      throw err;
    }
  }

  /**
   * Sanitize attributes object to strip sensitive security fields.
   */
  sanitizeAttributes(attrs: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(attrs)) {
      const lowerKey = key.toLowerCase();
      if (
        SENSITIVE_ATTRIBUTE_KEYS.has(lowerKey) ||
        lowerKey.includes('password') ||
        lowerKey.includes('token') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('auth')
      ) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }

  /**
   * Export span based on configured exporter with graceful fallback.
   */
  private exportSpan(span: Span): void {
    try {
      if (this.exporterType === 'console') {
        // Dev console logger
        const store = this.contextService.getStore();
        const payload = {
          message: `[TraceSpan] ${span.name}`,
          traceId: span.traceId,
          spanId: span.spanId,
          parentSpanId: span.parentSpanId,
          durationMs: span.durationMs,
          status: span.status,
          requestId: store?.requestId,
          correlationId: store?.correlationId,
          attributes: span.attributes,
        };
        this.logger.log(JSON.stringify(payload));
        this.metrics.traceExportTotal.inc({ exporter: 'console' });
      } else if (this.exporterType === 'otlp') {
        this.metrics.traceExportTotal.inc({ exporter: 'otlp' });
      } else if (this.exporterType === 'jaeger') {
        this.metrics.traceExportTotal.inc({ exporter: 'jaeger' });
      }
    } catch (err: any) {
      this.metrics.traceExportFailures.inc({
        exporter: this.exporterType,
        reason: err.message || 'export_error',
      });
      this.logger.warn(`Failed to export span ${span.name}: ${err.message}`);
    }
  }

  /** Exporter health status helpers */
  getOtlpStatus(): 'up' | 'down' {
    return this.otlpExporterStatus;
  }

  getJaegerStatus(): 'up' | 'down' {
    return this.jaegerExporterStatus;
  }

  isTracingEnabled(): boolean {
    return this.enabled;
  }
}
