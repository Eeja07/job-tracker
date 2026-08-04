import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TracingService } from './services/tracing.service';
import { TraceContextService } from './services/trace-context.service';
import { TracingMetricsService } from './services/tracing-metrics.service';
import { TraceMiddleware } from './middlewares/trace.middleware';
import { TraceInterceptor } from './interceptors/trace.interceptor';
import { PrismaTracingExtension } from './instrumentation/prisma-tracing.extension';
import { RedisTracing } from './instrumentation/redis-tracing';
import { BullMQTracing } from './instrumentation/bullmq-tracing';
import { WebSocketTracing } from './instrumentation/websocket-tracing';

@Global()
@Module({
  providers: [
    TracingService,
    TraceContextService,
    TracingMetricsService,
    TraceInterceptor,
    TraceMiddleware,
    PrismaTracingExtension,
    RedisTracing,
    BullMQTracing,
    WebSocketTracing,
  ],
  exports: [
    TracingService,
    TraceContextService,
    TracingMetricsService,
    TraceInterceptor,
    TraceMiddleware,
    PrismaTracingExtension,
    RedisTracing,
    BullMQTracing,
    WebSocketTracing,
  ],
})
export class TracingModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TraceMiddleware).forRoutes('*');
  }
}
