import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { Roles } from './decorators/rbac.decorators';
import { RbacService } from './services/rbac.service';

class AssignRoleDto {
  @IsString()
  @MinLength(2)
  roleName!: string;
}

@ApiTags('RBAC')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('rbac')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List all system roles (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'List of all roles' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden: requires ADMIN role' })
  async getAllRoles() {
    return this.rbacService.getAllRoles();
  }

  @Get('permissions')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List all system permissions (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'List of all permissions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden: requires ADMIN role' })
  async getAllPermissions() {
    return this.rbacService.getAllPermissions();
  }

  @Get('users/:userId/roles')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get roles for a user (ADMIN only)' })
  @ApiParam({ name: 'userId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Roles of the user' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden: requires ADMIN role' })
  async getUserRoles(@Param('userId', ParseUUIDPipe) userId: string) {
    const roles = await this.rbacService.getRoles(userId);
    return { userId, roles };
  }

  @Get('users/:userId/permissions')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get effective permissions for a user (ADMIN only)',
  })
  @ApiParam({ name: 'userId', type: String, format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Effective permissions of the user',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden: requires ADMIN role' })
  async getUserPermissions(@Param('userId', ParseUUIDPipe) userId: string) {
    const permissions = await this.rbacService.getPermissions(userId);
    return { userId, permissions };
  }

  @Post('users/:userId/roles')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Assign a role to a user (ADMIN only)' })
  @ApiParam({ name: 'userId', type: String, format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Role assigned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden: requires ADMIN role' })
  async assignRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AssignRoleDto,
  ) {
    await this.rbacService.assignRole(userId, dto.roleName);
    return { message: `Role '${dto.roleName}' assigned to user ${userId}` };
  }

  @Delete('users/:userId/roles/:roleName')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a role from a user (ADMIN only)' })
  @ApiParam({ name: 'userId', type: String, format: 'uuid' })
  @ApiParam({ name: 'roleName', type: String })
  @ApiResponse({ status: 204, description: 'Role removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden: requires ADMIN role' })
  async removeRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleName') roleName: string,
  ) {
    await this.rbacService.removeRole(userId, roleName);
  }
}
