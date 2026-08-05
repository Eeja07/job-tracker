import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { APP_INTERCEPTOR } from '@nestjs/core';
import configuration from './config/configuration';
import { validateEnv } from './config/env.schema';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { RedisThrottlerStorage } from './modules/redis/redis-throttler.storage';
import { JobsModule } from './modules/jobs/jobs.module';
import { EmailModule } from './modules/email/email.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { AuditLogInterceptor } from './modules/audit-log/interceptors/audit-log.interceptor';
import { RbacModule } from './modules/rbac/rbac.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './core/health/health.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { NotesModule } from './modules/notes/notes.module';
import { StatusHistoryModule } from './modules/status-history/status-history.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { StorageModule } from './modules/storage/storage.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { EventBusModule } from './modules/event-bus/event-bus.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { GmailModule } from './modules/gmail/gmail.module';
import { CqrsModule } from './core/cqrs/cqrs.module';
import { VersioningModule } from './core/versioning/versioning.module';
import { TracingModule } from './core/tracing/tracing.module';
import { TraceInterceptor } from './core/tracing/interceptors/trace.interceptor';
import { MetricsModule } from './core/metrics/metrics.module';
import { MetricsInterceptor } from './core/metrics/metrics.interceptor';
import { RequestIdMiddleware } from './core/middlewares/request-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
      },
    }),
    TracingModule,
    CqrsModule,
    VersioningModule,
    RedisModule,
    JobsModule,
    EmailModule,
    EventBusModule,
    AuditLogModule,
    RbacModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        throttlers: [
          {
            ttl: 60000,
            limit: 100,
          },
        ],
        storage,
      }),
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    MetricsModule,
    CompaniesModule,
    ApplicationsModule,
    AttachmentsModule,
    NotesModule,
    StatusHistoryModule,
    DashboardModule,
    StorageModule,
    FeatureFlagsModule,
    WebsocketModule,
    GmailModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TraceInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
