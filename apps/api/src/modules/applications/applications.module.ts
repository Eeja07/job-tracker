import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../repositories/repositories.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { ApplicationService } from './application.service';
import { ApplicationsController } from './applications.controller';
import { ApplicationsV2Controller } from './applications-v2.controller';
import { JobStatusCheckerService } from './job-status-checker.service';

@Module({
  imports: [RepositoriesModule, PrismaModule, RedisModule],
  controllers: [ApplicationsController, ApplicationsV2Controller],
  providers: [ApplicationService, JobStatusCheckerService],
  exports: [ApplicationService, JobStatusCheckerService],
})
export class ApplicationsModule {}
