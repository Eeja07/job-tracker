import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from '../services/audit-log.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    if (!req) {
      return next.handle();
    }

    const method = req.method;
    const isMutation = ['POST', 'PATCH', 'DELETE', 'PUT'].includes(method);

    if (!isMutation) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap(async (resData) => {
        try {
          const endpoint = req.originalUrl || req.url || '';
          const userId = req.user?.id || req.user?.userId || null;
          const requestId =
            (req.headers && req.headers['x-request-id']) || req.id || null;
          const ipAddress =
            (req.headers && (req.headers['x-forwarded-for'] as string)) ||
            req.ip ||
            null;
          const userAgent = (req.headers && req.headers['user-agent']) || null;

          const { resource, action } = this.resolveResourceAndAction(
            endpoint,
            method,
          );
          const resourceId = this.resolveResourceId(req, resData);

          const sanitizedBody = this.sanitizePayload(req.body);
          const metadata = {
            durationMs: Date.now() - startTime,
            statusCode: context.switchToHttp().getResponse()?.statusCode || 200,
            params: req.params,
            body: sanitizedBody,
          };

          await this.auditLogService.recordEvent({
            userId,
            action,
            resource,
            resourceId,
            method,
            endpoint,
            ipAddress,
            userAgent,
            requestId,
            metadata,
          });
        } catch (err: any) {
          this.logger.error(
            `Error recording automatic audit log: ${err.message}`,
          );
        }
      }),
    );
  }

  private resolveResourceAndAction(
    endpoint: string,
    method: string,
  ): { resource: string; action: string } {
    const cleanEndpoint = endpoint.toLowerCase();

    if (cleanEndpoint.includes('/auth/login')) {
      return { resource: 'AUTH', action: 'LOGIN' };
    }
    if (cleanEndpoint.includes('/auth/register')) {
      return { resource: 'AUTH', action: 'REGISTER' };
    }
    if (cleanEndpoint.includes('/auth/refresh')) {
      return { resource: 'AUTH', action: 'REFRESH' };
    }
    if (cleanEndpoint.includes('/auth/logout')) {
      return { resource: 'AUTH', action: 'LOGOUT' };
    }

    if (
      cleanEndpoint.includes('/applications') &&
      cleanEndpoint.includes('/status')
    ) {
      return { resource: 'APPLICATION', action: 'APPLICATION_STATUS_CHANGE' };
    }

    if (cleanEndpoint.includes('/applications')) {
      const actionMap: Record<string, string> = {
        POST: 'CREATE_APPLICATION',
        PATCH: 'UPDATE_APPLICATION',
        PUT: 'UPDATE_APPLICATION',
        DELETE: 'DELETE_APPLICATION',
      };
      return { resource: 'APPLICATION', action: actionMap[method] || method };
    }

    if (cleanEndpoint.includes('/companies')) {
      const actionMap: Record<string, string> = {
        POST: 'CREATE_COMPANY',
        PATCH: 'UPDATE_COMPANY',
        PUT: 'UPDATE_COMPANY',
        DELETE: 'DELETE_COMPANY',
      };
      return { resource: 'COMPANY', action: actionMap[method] || method };
    }

    if (cleanEndpoint.includes('/attachments')) {
      const actionMap: Record<string, string> = {
        POST: 'UPLOAD_ATTACHMENT',
        PATCH: 'UPDATE_ATTACHMENT',
        PUT: 'UPDATE_ATTACHMENT',
        DELETE: 'DELETE_ATTACHMENT',
      };
      return { resource: 'ATTACHMENT', action: actionMap[method] || method };
    }

    if (cleanEndpoint.includes('/email')) {
      return { resource: 'EMAIL', action: 'SEND_EMAIL' };
    }

    if (cleanEndpoint.includes('/jobs')) {
      return { resource: 'JOB', action: 'ENQUEUE_JOB' };
    }

    const segments = cleanEndpoint.split('/').filter(Boolean);
    const resourceSegment =
      segments.find((s) => !s.startsWith('v') && s !== 'api') || 'UNKNOWN';
    return {
      resource: resourceSegment.toUpperCase(),
      action: `${method}_${resourceSegment.toUpperCase()}`,
    };
  }

  private resolveResourceId(req: any, resData: any): string | null {
    if (req.params?.id) return req.params.id;
    if (req.params?.applicationId) return req.params.applicationId;
    if (req.params?.companyId) return req.params.companyId;
    if (req.params?.attachmentId) return req.params.attachmentId;

    if (resData?.data?.id) return resData.data.id;
    if (resData?.id) return resData.id;

    return null;
  }

  private sanitizePayload(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sensitiveFields = [
      'password',
      'passwordHash',
      'token',
      'refreshToken',
      'secret',
      'creditCard',
    ];
    const sanitized = Array.isArray(body) ? [...body] : { ...body };

    for (const key of Object.keys(sanitized)) {
      if (sensitiveFields.includes(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (
        typeof sanitized[key] === 'object' &&
        sanitized[key] !== null
      ) {
        sanitized[key] = this.sanitizePayload(sanitized[key]);
      }
    }

    return sanitized;
  }
}
