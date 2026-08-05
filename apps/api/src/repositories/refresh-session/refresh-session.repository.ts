import { Injectable } from '@nestjs/common';
import { RefreshSession, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from '../base/base.repository';

export interface CreateRefreshSessionData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class RefreshSessionRepository extends BaseRepository<Prisma.RefreshSessionDelegate> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getDelegate(
    tx?: Prisma.TransactionClient,
  ): Prisma.RefreshSessionDelegate {
    return tx ? tx.refreshSession : this.prisma.refreshSession;
  }

  async create(
    data: CreateRefreshSessionData,
    tx?: Prisma.TransactionClient,
  ): Promise<RefreshSession> {
    return this.getDelegate(tx).create({ data });
  }

  async findByUserId(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<RefreshSession | null> {
    return this.getDelegate(tx).findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteByUserId(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.BatchPayload> {
    return this.getDelegate(tx).deleteMany({
      where: { userId },
    });
  }
}
