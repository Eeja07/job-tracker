import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TracingService } from '../services/tracing.service';
import { TraceContextService } from '../services/trace-context.service';
import { SPAN_NAMES } from '../constants/tracing.constants';

@Injectable()
export class TraceInterceptor implements NestInterceptor {
  constructor(
    private readonly tracingService: TracingService,
    private readonly contextService: TraceContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const type = context.getType();
    const className = context.getClass().name;
    const methodName = context.getHandler().name;

    if (type === 'http') {
      const httpCtx = context.switchToHttp();
      const req = httpCtx.getRequest();
      const res = httpCtx.getResponse();

      // Extract route path pattern if available
      const routePath = req.route?.path || req.url || 'unknown';

      // Start HTTP request span
      const httpSpan = this.tracingService.startSpan(SPAN_NAMES.HTTP_REQUEST, undefined, {
        'http.method': req.method,
        'http.route': routePath,
        'http.url': req.originalUrl || req.url,
      });

      // Start Controller span
      const controllerSpan = this.tracingService.startSpan(SPAN_NAMES.CONTROLLER, {
        traceId: httpSpan.traceId,
        spanId: httpSpan.spanId,
      }, {
        'code.namespace': className,
        'code.function': methodName,
      });

      // Extract user ID if authenticated
      if (req.user?.sub) {
        this.contextService.setUserId(req.user.sub);
        httpSpan.attributes['user.id'] = req.user.sub;
        controllerSpan.attributes['user.id'] = req.user.sub;
      }

      return next.handle().pipe(
        tap({
          next: () => {
            const statusCode = res.statusCode || 200;
            httpSpan.attributes['http.status_code'] = statusCode;
            controllerSpan.attributes['http.status_code'] = statusCode;

            this.tracingService.endSpan(controllerSpan);
            this.tracingService.endSpan(httpSpan);
          },
          error: (err: Error) => {
            const statusCode = (err as any).status || res.statusCode || 500;
            httpSpan.attributes['http.status_code'] = statusCode;
            controllerSpan.attributes['http.status_code'] = statusCode;

            this.tracingService.endSpan(controllerSpan, err);
            this.tracingService.endSpan(httpSpan, err);
          },
        }),
      );
    }

    // Fallback non-HTTP execution
    return next.handle();
  }
}
