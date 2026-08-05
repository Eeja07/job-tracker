import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import compression from 'compression';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './core/filters/http-exception.filter';
import { LoggingInterceptor } from './core/interceptors/logging.interceptor';

import { VersioningType } from '@nestjs/common';
import { applyVersionMiddleware } from './core/versioning/middlewares/version.middleware';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const corsOrigin = configService.get<string>('CORS_ORIGIN', '*');

  // Increase payload size limit to handle images / CVs / notes payloads
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  // Security & Optimization Middleware
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(','),
    credentials: true,
  });

  // Multi-Strategy Versioning Middleware & URI Version Router Setup
  app.use(applyVersionMiddleware);
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Global Interceptors & Filters
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Swagger Documentation - Version 1
  const configV1 = new DocumentBuilder()
    .setTitle('Job Tracker API - v1 (Deprecated)')
    .setDescription('Legacy API endpoints (Version 1.0) - Sunset Date: 01 Dec 2025')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const documentV1 = SwaggerModule.createDocument(app, configV1);
  SwaggerModule.setup('docs/v1', app, documentV1);
  SwaggerModule.setup('api/docs', app, documentV1);

  // Swagger Documentation - Version 2
  const configV2 = new DocumentBuilder()
    .setTitle('Job Tracker API - v2')
    .setDescription('Current Production REST API (Version 2.0)')
    .setVersion('2.0')
    .addBearerAuth()
    .build();
  const documentV2 = SwaggerModule.createDocument(app, configV2);
  SwaggerModule.setup('docs/v2', app, documentV2);

  await app.listen(port);
  const appLogger = app.get(Logger);
  appLogger.log(`Server running on port ${port} [API Versions: /api/v1, /api/v2]`);
  appLogger.log(`Swagger docs available at /docs/v1 and /docs/v2`);
}

bootstrap();
