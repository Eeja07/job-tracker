import { Module, Global } from '@nestjs/common';
import { RepositoriesModule } from '../../repositories/repositories.module';
import { AuditLogService } from './services/audit-log.service';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { AuditLogController } from './audit-log.controller';

@Global()
@Module({
  imports: [RepositoriesModule],
  providers: [AuditLogService, AuditLogInterceptor],
  controllers: [AuditLogController],
  exports: [AuditLogService, AuditLogInterceptor],
})
export class AuditLogModule {}
