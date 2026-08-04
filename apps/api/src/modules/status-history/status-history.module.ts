import { Module } from '@nestjs/common';
import { StatusHistoryController } from './status-history.controller';

@Module({
  controllers: [StatusHistoryController],
})
export class StatusHistoryModule {}
