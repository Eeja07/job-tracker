import { Injectable } from '@nestjs/common';
import { StatusHistory, ApplicationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from '../base/base.repository';

export interface CreateStatusHistoryData {
  applicationId: string;
  userId: string;
  fromStatus?: ApplicationStatus;
  toStatus: ApplicationStatus;
}

@Injectable()
export class StatusHistoryRepository extends BaseRepository<Prisma.StatusHistoryDelegate> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getDelegate(
    tx?: Prisma.TransactionClient,
  ): Prisma.StatusHistoryDelegate {
    return tx ? tx.statusHistory : this.prisma.statusHistory;
  }

  async append(
    data: CreateStatusHistoryData,
    tx?: Prisma.TransactionClient,
  ): Promise<StatusHistory> {
    return this.getDelegate(tx).create({
      data,
    });
  }

  async findTimeline(
    applicationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<StatusHistory[]> {
    return this.getDelegate(tx).findMany({
      where: { applicationId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
