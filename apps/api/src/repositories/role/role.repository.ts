import { Injectable } from '@nestjs/common';
import { Role, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from '../base/base.repository';

@Injectable()
export class RoleRepository extends BaseRepository<Prisma.RoleDelegate> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getDelegate(tx?: Prisma.TransactionClient): Prisma.RoleDelegate {
    return tx ? tx.role : this.prisma.role;
  }

  async findByName(name: string, tx?: Prisma.TransactionClient): Promise<Role | null> {
    return this.getDelegate(tx).findUnique({ where: { name } });
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<Role | null> {
    return this.getDelegate(tx).findUnique({ where: { id } });
  }

  async findAll(tx?: Prisma.TransactionClient): Promise<Role[]> {
    return this.getDelegate(tx).findMany({ orderBy: { name: 'asc' } });
  }

  async create(data: { name: string; description?: string }, tx?: Prisma.TransactionClient): Promise<Role> {
    return this.getDelegate(tx).create({ data });
  }
}
