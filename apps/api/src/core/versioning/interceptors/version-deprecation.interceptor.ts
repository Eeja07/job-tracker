import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { Response } from 'express';
import {
  DEPRECATED_ENDPOINT_KEY,
  DeprecatedOptions,
} from '../decorators/deprecated-endpoint.decorator';
import { VersionMetricsService } from '../services/version-metrics.service';
import { RequestWithApiVersion } from '../middlewares/version.middleware';

@Injectable()
export class VersionDeprecationInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly metricsService?: VersionMetricsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const req = httpContext.getRequest<RequestWithApiVersion>();
    const res = httpContext.getResponse<Response>();

    const handler = context.getHandler();
    const controllerClass = context.getClass();

    const deprecatedMeta =
      this.reflector.get<DeprecatedOptions & { isDeprecated: boolean }>(
        DEPRECATED_ENDPOINT_KEY,
        handler,
      ) ||
      this.reflector.get<DeprecatedOptions & { isDeprecated: boolean }>(
        DEPRECATED_ENDPOINT_KEY,
        controllerClass,
      );

    const version = req?.apiVersion || '1';
    const path = req?.route?.path || req?.originalUrl || req?.url || 'unknown';
    const method = req?.method || 'GET';

    if (this.metricsService) {
      this.metricsService.apiVersionRequestsTotal.inc({
        version,
        path,
        method,
      });
    }

    if (deprecatedMeta && res) {
      res.setHeader('Deprecation', 'true');
      if (deprecatedMeta.sunsetDate) {
        res.setHeader('Sunset', deprecatedMeta.sunsetDate);
      }
      if (deprecatedMeta.infoUrl) {
        res.setHeader('Link', `<${deprecatedMeta.infoUrl}>; rel="deprecation"`);
      }

      if (this.metricsService) {
        this.metricsService.deprecatedEndpointHitsTotal.inc({
          version,
          endpoint: `${method} ${path}`,
        });
      }
    }

    return next.handle();
  }
}
