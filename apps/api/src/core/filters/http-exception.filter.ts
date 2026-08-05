import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export type RequestWithId = Request & {
  id?: string;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    const requestId = (request as { id?: string })?.id || (request?.headers?.['x-request-id'] as string) || 'unknown';
    const isHttpException = exception instanceof HttpException;

    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse: string | object = isHttpException
      ? exception.getResponse()
      : 'Internal Server Error';

    let errorName = isHttpException ? exception.name : 'InternalServerError';
    let message: string | string[] = 'An unexpected error occurred';

    if (typeof errorResponse === 'object' && errorResponse !== null) {
      const respObj = errorResponse as Record<string, unknown>;
      message = (respObj.message as string | string[]) || message;
      errorName = (respObj.error as string) || errorName;
    } else if (typeof errorResponse === 'string') {
      message = errorResponse;
    }

    // Classify error type for structured logging
    let errorCategory = 'UNHANDLED_EXCEPTION';
    const excName = exception && typeof exception === 'object' && 'name' in exception ? (exception as { name: string }).name : '';

    if (excName.includes('Prisma') || (exception && typeof exception === 'object' && 'code' in exception && String((exception as { code: unknown }).code).startsWith('P'))) {
      errorCategory = 'PRISMA_ERROR';
    } else if (excName.includes('JsonWebToken') || excName.includes('Jwt') || errorName.includes('Unauthorized')) {
      errorCategory = 'JWT_ERROR';
    } else if (statusCode === HttpStatus.BAD_REQUEST && Array.isArray(message)) {
      errorCategory = 'VALIDATION_ERROR';
    }

    const logDetails = {
      timestamp: new Date().toISOString(),
      requestId,
      errorCategory,
      statusCode,
      method: request.method,
      url: request.url,
      errorName,
      message,
      stack: exception instanceof Error ? exception.stack : undefined,
    };

    if (statusCode >= 500) {
      this.logger.error(JSON.stringify(logDetails));
    } else {
      this.logger.warn(JSON.stringify(logDetails));
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      error: errorName,
      message,
      details: exception instanceof Error ? exception.message : String(exception),
      timestamp: logDetails.timestamp,
      path: request.url,
    });
  }
}
