import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../repositories/repositories.module';
import { RedisModule } from '../redis/redis.module';
import { CompanyService } from './company.service';
import { CompaniesController } from './companies.controller';

@Module({
  imports: [RepositoriesModule, RedisModule],
  controllers: [CompaniesController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompaniesModule {}
