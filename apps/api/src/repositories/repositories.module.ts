import { Module } from '@nestjs/common';
import { UserRepository } from './user/user.repository';
import { CompanyRepository } from './company/company.repository';
import { ApplicationRepository } from './application/application.repository';
import { StatusHistoryRepository } from './status-history/status-history.repository';
import { AttachmentRepository } from './attachment/attachment.repository';
import { NoteRepository } from './note/note.repository';
import { DashboardRepository } from './dashboard/dashboard.repository';
import { RefreshSessionRepository } from './refresh-session/refresh-session.repository';
import { AuditLogRepository } from './audit-log/audit-log.repository';
import { RoleRepository } from './role/role.repository';
import { PermissionRepository } from './permission/permission.repository';
import { UserRoleRepository } from './user-role/user-role.repository';
import { RolePermissionRepository } from './role-permission/role-permission.repository';

const repositories = [
  UserRepository,
  CompanyRepository,
  ApplicationRepository,
  StatusHistoryRepository,
  AttachmentRepository,
  NoteRepository,
  DashboardRepository,
  RefreshSessionRepository,
  AuditLogRepository,
  RoleRepository,
  PermissionRepository,
  UserRoleRepository,
  RolePermissionRepository,
];

@Module({
  providers: [...repositories],
  exports: [...repositories],
})
export class RepositoriesModule {}
