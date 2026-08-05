import { Injectable } from '@nestjs/common';
import {
  Application,
  ApplicationStatus,
  WorkMode,
  ApplicationSource,
  Currency,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from '../base/base.repository';

export interface CreateApplicationData {
  userId: string;
  companyId?: string;
  jobTitle: string;
  applicationCode?: string;
  status?: ApplicationStatus;
  workMode?: WorkMode;
  source?: ApplicationSource;
  salaryMin?: number;
  salaryMax?: number;
  currency?: Currency;
  sourceUrl?: string;
  location?: string;
  deadline?: Date;
  appliedAt?: Date;
  requirements?: string;
  notesContent?: string;
  notesImages?: string[];
  imageUrl?: string;
  cvName?: string;
  cvUrl?: string;
  cvText?: string;
  portfolioName?: string;
  portfolioUrl?: string;
}

export interface UpdateApplicationData {
  companyId?: string;
  jobTitle?: string;
  applicationCode?: string;
  status?: ApplicationStatus;
  workMode?: WorkMode;
  source?: ApplicationSource;
  salaryMin?: number;
  salaryMax?: number;
  currency?: Currency;
  sourceUrl?: string;
  location?: string;
  deadline?: Date;
  appliedAt?: Date;
  lastStatusChangedAt?: Date;
  requirements?: string;
  notesContent?: string;
  notesImages?: string[];
  imageUrl?: string;
  cvName?: string;
  cvUrl?: string;
  cvText?: string;
  portfolioName?: string;
  portfolioUrl?: string;
}

export interface ApplicationFilterParams {
  status?: ApplicationStatus;
  companyId?: string;
  source?: ApplicationSource;
  deadlineBefore?: Date;
  deadlineAfter?: Date;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class ApplicationRepository extends BaseRepository<Prisma.ApplicationDelegate> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getDelegate(
    tx?: Prisma.TransactionClient,
  ): Prisma.ApplicationDelegate {
    return tx ? tx.application : this.prisma.application;
  }

  async findWithFilters(
    userId: string,
    params: ApplicationFilterParams,
    tx?: Prisma.TransactionClient,
  ): Promise<Application[]> {
    const {
      status,
      companyId,
      source,
      deadlineBefore,
      deadlineAfter,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.ApplicationWhereInput = {
      userId,
      ...(status && { status }),
      ...(companyId && { companyId }),
      ...(source && { source }),
      ...(deadlineBefore || deadlineAfter
        ? {
            deadline: {
              ...(deadlineBefore && { lte: deadlineBefore }),
              ...(deadlineAfter && { gte: deadlineAfter }),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { jobTitle: { contains: search, mode: 'insensitive' } },
              { company: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    return this.getDelegate(tx).findMany({
      where,
      include: {
        company: {
          select: { id: true, name: true },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    });
  }

  async findById(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Application | null> {
    return this.getDelegate(tx).findUnique({
      where: { id },
      include: {
        company: true,
      },
    });
  }

  async findByUser(
    userId: string,
    limit = 50,
    tx?: Prisma.TransactionClient,
  ): Promise<Application[]> {
    return this.getDelegate(tx).findMany({
      where: { userId },
      include: {
        company: {
          select: { id: true, name: true },
        },
      },
      orderBy: { appliedAt: 'desc' },
      take: limit,
    });
  }

  async findByStatus(
    userId: string,
    status: ApplicationStatus,
    tx?: Prisma.TransactionClient,
  ): Promise<Application[]> {
    return this.getDelegate(tx).findMany({
      where: { userId, status },
      include: {
        company: {
          select: { id: true, name: true },
        },
      },
      orderBy: { lastStatusChangedAt: 'desc' },
    });
  }

  async findRecent(
    userId: string,
    limit = 5,
    tx?: Prisma.TransactionClient,
  ): Promise<Application[]> {
    return this.getDelegate(tx).findMany({
      where: { userId },
      include: {
        company: {
          select: { id: true, name: true },
        },
      },
      orderBy: { lastStatusChangedAt: 'desc' },
      take: limit,
    });
  }

  async create(
    data: CreateApplicationData,
    tx?: Prisma.TransactionClient,
  ): Promise<Application> {
    return this.getDelegate(tx).create({
      data,
    });
  }

  async updateStatus(
    id: string,
    status: ApplicationStatus,
    tx?: Prisma.TransactionClient,
  ): Promise<Application> {
    return this.getDelegate(tx).update({
      where: { id },
      data: {
        status,
        lastStatusChangedAt: new Date(),
      },
    });
  }

  async update(
    id: string,
    data: UpdateApplicationData,
    tx?: Prisma.TransactionClient,
  ): Promise<Application> {
    return this.getDelegate(tx).update({
      where: { id },
      data,
    });
  }

  async delete(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Application> {
    return this.getDelegate(tx).delete({
      where: { id },
    });
  }
}
