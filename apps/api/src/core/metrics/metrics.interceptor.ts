import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const start = process.hrtime();
    this.metricsService.activeRequests.inc();

    return next.handle().pipe(
      tap({
        next: () => this.recordMetrics(req, res, start),
        error: () => this.recordMetrics(req, res, start),
      }),
    );
  }

  private recordMetrics(req: Request, res: Response, start: [number, number]): void {
    this.metricsService.activeRequests.dec();

    const diff = process.hrtime(start);
    const durationInSeconds = diff[0] + diff[1] / 1e9;

    const method = req.method;
    const route = req.route?.path || req.path || 'unknown';
    const statusCode = res.statusCode ? res.statusCode.toString() : '500';

    this.metricsService.httpRequestsTotal.inc({ method, route, status_code: statusCode });
    this.metricsService.httpRequestDurationSeconds.observe(
      { method, route, status_code: statusCode },
      durationInSeconds,
    );
  }
}
