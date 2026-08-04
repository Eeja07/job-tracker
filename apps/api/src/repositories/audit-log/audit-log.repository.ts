import { Injectable } from '@nestjs/common';
import { AuditLog, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from '../base/base.repository';

export interface CreateAuditLogData {
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  method: string;
  endpoint: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  metadata?: Record<string, any> | Prisma.InputJsonValue;
  createdAt?: Date;
}

export interface AuditLogSearchOptions {
  userId?: string;
  action?: string;
  resource?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class AuditLogRepository extends BaseRepository<Prisma.AuditLogDelegate> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getDelegate(tx?: Prisma.TransactionClient): Prisma.AuditLogDelegate {
    return tx ? tx.auditLog : this.prisma.auditLog;
  }

  async create(data: CreateAuditLogData, tx?: Prisma.TransactionClient): Promise<AuditLog> {
    return this.getDelegate(tx).create({
      data: {
        userId: data.userId || null,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId || null,
        method: data.method,
        endpoint: data.endpoint,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        requestId: data.requestId || null,
        metadata: (data.metadata as Prisma.InputJsonValue) ?? {},
        ...(data.createdAt && { createdAt: data.createdAt }),
      },
    });
  }

  async findByUser(
    userId: string,
    page = 1,
    limit = 20,
    tx?: Prisma.TransactionClient,
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = { userId };
    const [logs, total] = await Promise.all([
      this.getDelegate(tx).findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.getDelegate(tx).count({ where }),
    ]);
    return { logs, total };
  }

  async findRecent(limit = 10, tx?: Prisma.TransactionClient): Promise<AuditLog[]> {
    return this.getDelegate(tx).findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async search(
    options: AuditLogSearchOptions,
    tx?: Prisma.TransactionClient,
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const {
      userId,
      action,
      resource,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const where: Prisma.AuditLogWhereInput = {
      ...(userId && { userId }),
      ...(action && { action }),
      ...(resource && { resource }),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { action: { contains: search, mode: 'insensitive' } },
              { resource: { contains: search, mode: 'insensitive' } },
              { endpoint: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      this.getDelegate(tx).findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.getDelegate(tx).count({ where }),
    ]);

    return { logs, total };
  }
}
