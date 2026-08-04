import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../repositories/repositories.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { ApplicationService } from './application.service';
import { ApplicationsController } from './applications.controller';
import { ApplicationsV2Controller } from './applications-v2.controller';

@Module({
  imports: [RepositoriesModule, PrismaModule, RedisModule],
  controllers: [ApplicationsController, ApplicationsV2Controller],
  providers: [ApplicationService],
  exports: [ApplicationService],
})
export class ApplicationsModule {}
