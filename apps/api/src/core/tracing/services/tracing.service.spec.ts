import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TracingService } from './tracing.service';
import { TraceContextService } from './trace-context.service';
import { TracingMetricsService } from './tracing-metrics.service';

describe('TracingService', () => {
  let service: TracingService;
  let contextService: TraceContextService;
  let metricsService: TracingMetricsService;

  beforeEach(async () => {
    const mockConfig = {
      get: jest.fn((key: string, defaultVal?: any) => {
        if (key === 'OTEL_TRACING_ENABLED') return 'true';
        if (key === 'OTEL_EXPORTER_TYPE') return 'console';
        if (key === 'OTEL_SAMPLE_RATE') return '1.0'; // AlwaysOn for test
        return defaultVal;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TracingService,
        TraceContextService,
        TracingMetricsService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<TracingService>(TracingService);
    contextService = module.get<TraceContextService>(TraceContextService);
    metricsService = module.get<TracingMetricsService>(TracingMetricsService);

    service.onModuleInit();
  });

  it('should generate valid 16-byte hex traceId and 8-byte hex spanId', () => {
    const traceId = service.generateTraceId();
    const spanId = service.generateSpanId();

    expect(traceId).toHaveLength(32);
    expect(spanId).toHaveLength(16);
    expect(/^[0-9a-f]+$/.test(traceId)).toBe(true);
    expect(/^[0-9a-f]+$/.test(spanId)).toBe(true);
  });

  it('should start and end a span with duration', () => {
    const span = service.startSpan('test.span', undefined, { 'app.name': 'job-tracker' });
    expect(span.name).toBe('test.span');
    expect(span.attributes['app.name']).toBe('job-tracker');
    expect(span.startTime).toBeLessThanOrEqual(Date.now());

    service.endSpan(span);
    expect(span.endTime).toBeDefined();
    expect(span.durationMs).toBeGreaterThanOrEqual(0);
    expect(span.status).toBe('OK');
  });

  it('should mark span status as ERROR when an error is passed to endSpan', () => {
    const span = service.startSpan('test.error.span');
    const err = new Error('Database connection failed');
    service.endSpan(span, err);

    expect(span.status).toBe('ERROR');
    expect(span.attributes['error.message']).toBe('Database connection failed');
  });

  it('should wrap execution in trace() method', async () => {
    const result = await service.trace('service.operation', async (span) => {
      span.attributes['operation.step'] = 1;
      return 'success';
    });

    expect(result).toBe('success');
  });

  it('should sanitize sensitive security attributes', () => {
    const rawAttrs = {
      user_id: '123',
      password: 'SuperSecretPassword',
      accessToken: 'Bearer eyJhbGciOi...',
      authorization: 'Bearer token',
      normalField: 'hello',
    };

    const sanitized = service.sanitizeAttributes(rawAttrs);
    expect(sanitized.user_id).toBe('123');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.accessToken).toBe('[REDACTED]');
    expect(sanitized.authorization).toBe('[REDACTED]');
    expect(sanitized.normalField).toBe('hello');
  });
});
