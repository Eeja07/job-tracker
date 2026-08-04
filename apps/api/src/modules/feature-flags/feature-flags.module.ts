import { Module } from '@nestjs/common';
import { FeatureFlagService } from './services/feature-flag.service';
import { FeatureFlagsController } from './controllers/feature-flag.controller';
import { FeatureFlagGuard } from './guards/feature-flag.guard';
import { RepositoriesModule } from '../../repositories/repositories.module';
import { RedisModule } from '../redis/redis.module';
import { MetricsModule } from '../../core/metrics/metrics.module';

@Module({
  imports: [RepositoriesModule, RedisModule, MetricsModule],
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagService, FeatureFlagGuard],
  exports: [FeatureFlagService, FeatureFlagGuard],
})
export class FeatureFlagsModule {}
