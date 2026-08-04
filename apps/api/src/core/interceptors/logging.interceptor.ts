import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

export type RequestWithUser = Request & {
  id?: string;
  user?: { sub?: string; email?: string };
};

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const ctx = context.switchToHttp();
    const req = ctx.getRequest<RequestWithUser>();
    const res = ctx.getResponse<Response>();
    const { method, url } = req;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.logRequest(req, res, method, url, startTime),
        error: () => this.logRequest(req, res, method, url, startTime),
      }),
    );
  }

  private logRequest(
    req: RequestWithUser,
    res: Response,
    method: string,
    url: string,
    startTime: number,
  ): void {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode || 500;
    const requestId = (req as { id?: string })?.id || (req?.headers?.['x-request-id'] as string) || 'unknown';
    const traceId = (req as any)?.traceId || (req?.headers?.['x-trace-id'] as string) || undefined;
    const spanId = (req as any)?.spanId || (req?.headers?.['x-span-id'] as string) || undefined;
    const correlationId = (req as any)?.correlationId || (req?.headers?.['x-correlation-id'] as string) || requestId;
    const userId = req.user?.sub || 'anonymous';
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    const logPayload = {
      timestamp: new Date().toISOString(),
      traceId,
      spanId,
      requestId,
      correlationId,
      userId,
      method,
      url,
      status: statusCode,
      duration,
      ip,
      userAgent,
    };

    this.logger.log(JSON.stringify(logPayload));
  }
}
