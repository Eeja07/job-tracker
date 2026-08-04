import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RedisModule } from '../../modules/redis/redis.module';
import { JobsModule } from '../../modules/jobs/jobs.module';
import { EmailModule } from '../../modules/email/email.module';

@Module({
  imports: [RedisModule, JobsModule, EmailModule],
  controllers: [HealthController],
})
export class HealthModule {}
