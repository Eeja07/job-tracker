import { Injectable } from '@nestjs/common';
import { UserRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from '../base/base.repository';

@Injectable()
export class UserRoleRepository extends BaseRepository<Prisma.UserRoleDelegate> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getDelegate(tx?: Prisma.TransactionClient): Prisma.UserRoleDelegate {
    return tx ? tx.userRole : this.prisma.userRole;
  }

  async findByUser(userId: string, tx?: Prisma.TransactionClient): Promise<UserRole[]> {
    return this.getDelegate(tx).findMany({
      where: { userId },
      include: { role: true },
    });
  }

  async findByUserAndRole(userId: string, roleId: string, tx?: Prisma.TransactionClient): Promise<UserRole | null> {
    return this.getDelegate(tx).findUnique({
      where: { userId_roleId: { userId, roleId } },
    });
  }

  async assign(userId: string, roleId: string, tx?: Prisma.TransactionClient): Promise<UserRole> {
    return this.getDelegate(tx).upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId },
    });
  }

  async remove(userId: string, roleId: string, tx?: Prisma.TransactionClient): Promise<void> {
    await this.getDelegate(tx).deleteMany({ where: { userId, roleId } });
  }

  async getRoleNamesForUser(userId: string, tx?: Prisma.TransactionClient): Promise<string[]> {
    const userRoles = await this.getDelegate(tx).findMany({
      where: { userId },
      include: { role: { select: { name: true } } },
    });
    return (userRoles as any[]).map((ur) => ur.role.name);
  }
}
