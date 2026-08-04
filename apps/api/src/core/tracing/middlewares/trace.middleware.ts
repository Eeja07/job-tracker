import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { TraceContextService, TraceContextStore } from '../services/trace-context.service';
import { TracingService } from '../services/tracing.service';
import { SPAN_NAMES } from '../constants/tracing.constants';

export type RequestWithTraceContext = Request & {
  id?: string;
  traceId?: string;
  spanId?: string;
  correlationId?: string;
};

@Injectable()
export class TraceMiddleware implements NestMiddleware {
  constructor(
    private readonly tracingService: TracingService,
    private readonly contextService: TraceContextService,
  ) {}

  use(req: RequestWithTraceContext, res: Response, next: NextFunction): void {
    // Read or extract trace context headers (W3C traceparent / B3 / X-Trace-Id / X-Request-Id / X-Correlation-Id)
    const traceparent = req.headers['traceparent'] as string | undefined;
    let traceId: string | undefined;
    let parentSpanId: string | undefined;

    if (traceparent && traceparent.startsWith('00-')) {
      const parts = traceparent.split('-');
      if (parts.length >= 3) {
        traceId = parts[1];
        parentSpanId = parts[2];
      }
    }

    if (!traceId) {
      traceId = (req.headers['x-trace-id'] as string) || this.tracingService.generateTraceId();
    }

    const spanId = this.tracingService.generateSpanId();
    const requestId = (req as any).id || (req.headers['x-request-id'] as string) || randomUUID();
    const correlationId = (req.headers['x-correlation-id'] as string) || requestId;
    const sampled = this.tracingService.shouldSample(traceId);

    // Set HTTP response headers for trace propagation
    res.setHeader('X-Trace-Id', traceId);
    res.setHeader('X-Span-Id', spanId);
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Correlation-Id', correlationId);
    res.setHeader('traceparent', `00-${traceId}-${spanId}-0${sampled ? '1' : '0'}`);

    req.traceId = traceId;
    req.spanId = spanId;
    req.correlationId = correlationId;

    const store: TraceContextStore = {
      traceId,
      spanId,
      parentSpanId,
      requestId,
      correlationId,
      sampled,
      attributes: {
        'http.method': req.method,
        'http.url': req.originalUrl || req.url,
        'http.user_agent': req.headers['user-agent'] || 'unknown',
        'http.remote_addr': req.ip || req.socket?.remoteAddress || 'unknown',
      },
    };

    // Store context in AsyncLocalStorage for downstream components
    this.contextService.run(store, () => {
      next();
    });
  }
}
