import { Module, Global } from '@nestjs/common';
import { RepositoriesModule } from '../../repositories/repositories.module';
import { RbacService } from './services/rbac.service';
import { RbacController } from './rbac.controller';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';

@Global()
@Module({
  imports: [RepositoriesModule],
  providers: [RbacService, RolesGuard, PermissionsGuard],
  controllers: [RbacController],
  exports: [RbacService, RolesGuard, PermissionsGuard],
})
export class RbacModule {}
