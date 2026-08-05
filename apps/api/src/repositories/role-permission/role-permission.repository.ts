import { Injectable } from '@nestjs/common';
import { RolePermission, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from '../base/base.repository';

@Injectable()
export class RolePermissionRepository extends BaseRepository<Prisma.RolePermissionDelegate> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getDelegate(
    tx?: Prisma.TransactionClient,
  ): Prisma.RolePermissionDelegate {
    return tx ? tx.rolePermission : this.prisma.rolePermission;
  }

  async findByRole(
    roleId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<RolePermission[]> {
    return this.getDelegate(tx).findMany({ where: { roleId } });
  }

  async assign(
    roleId: string,
    permissionId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<RolePermission> {
    return this.getDelegate(tx).upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      update: {},
      create: { roleId, permissionId },
    });
  }

  async remove(
    roleId: string,
    permissionId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.getDelegate(tx).deleteMany({ where: { roleId, permissionId } });
  }

  async getPermissionNamesForUser(userId: string): Promise<string[]> {
    const permissions = await this.prisma.permission.findMany({
      where: {
        rolePermissions: {
          some: {
            role: {
              userRoles: {
                some: { userId },
              },
            },
          },
        },
      },
      select: { name: true },
    });
    return permissions.map((p) => p.name);
  }
}
