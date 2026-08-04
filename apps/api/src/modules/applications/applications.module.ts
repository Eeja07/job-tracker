import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../repositories/repositories.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { ApplicationService } from './application.service';
import { ApplicationsController } from './applications.controller';

@Module({
  imports: [RepositoriesModule, PrismaModule, RedisModule],
  controllers: [ApplicationsController],
  providers: [ApplicationService],
  exports: [ApplicationService],
})
export class ApplicationsModule {}
