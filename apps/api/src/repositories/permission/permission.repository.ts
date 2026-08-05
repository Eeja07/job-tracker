import { Injectable } from '@nestjs/common';
import { Permission, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from '../base/base.repository';

@Injectable()
export class PermissionRepository extends BaseRepository<Prisma.PermissionDelegate> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getDelegate(
    tx?: Prisma.TransactionClient,
  ): Prisma.PermissionDelegate {
    return tx ? tx.permission : this.prisma.permission;
  }

  async findByName(
    name: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Permission | null> {
    return this.getDelegate(tx).findUnique({ where: { name } });
  }

  async findById(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Permission | null> {
    return this.getDelegate(tx).findUnique({ where: { id } });
  }

  async findAll(tx?: Prisma.TransactionClient): Promise<Permission[]> {
    return this.getDelegate(tx).findMany({ orderBy: { name: 'asc' } });
  }

  async findByRole(
    roleId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Permission[]> {
    const rolePerms = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });
    return rolePerms.map((rp) => rp.permission);
  }
}
