import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { VersionMetricsService } from './services/version-metrics.service';
import { VersionMiddleware } from './middlewares/version.middleware';
import { VersionDeprecationInterceptor } from './interceptors/version-deprecation.interceptor';

@Global()
@Module({
  providers: [
    VersionMetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: VersionDeprecationInterceptor,
    },
  ],
  exports: [VersionMetricsService],
})
export class VersioningModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(VersionMiddleware).forRoutes('*');
  }

  /** Health probe check */
  static isHealthy(): boolean {
    return true;
  }
}
