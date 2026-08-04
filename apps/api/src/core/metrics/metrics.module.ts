import { Module, Global } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { RedisModule } from '../../modules/redis/redis.module';
import { JobsModule } from '../../modules/jobs/jobs.module';

@Global()
@Module({
  imports: [RedisModule, JobsModule],
  providers: [MetricsService, MetricsInterceptor],
  controllers: [MetricsController],
  exports: [MetricsService, MetricsInterceptor],
})
export class MetricsModule {}
