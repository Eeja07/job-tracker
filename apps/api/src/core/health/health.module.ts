import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RedisModule } from '../../modules/redis/redis.module';
import { JobsModule } from '../../modules/jobs/jobs.module';
import { EmailModule } from '../../modules/email/email.module';
import { WebsocketModule } from '../../modules/websocket/websocket.module';

@Module({
  imports: [RedisModule, JobsModule, EmailModule, WebsocketModule],
  controllers: [HealthController],
})
export class HealthModule {}
