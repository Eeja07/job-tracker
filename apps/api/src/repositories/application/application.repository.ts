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
  rejectedAtStage?: string;
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
  coverLetterName?: string;
  coverLetterUrl?: string;
  coverLetterText?: string;
}

export interface UpdateApplicationData {
  companyId?: string | null;
  jobTitle?: string;
  applicationCode?: string | null;
  status?: ApplicationStatus;
  workMode?: WorkMode | null;
  source?: ApplicationSource | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: Currency;
  sourceUrl?: string | null;
  location?: string | null;
  deadline?: Date | null;
  appliedAt?: Date;
  lastStatusChangedAt?: Date;
  rejectedAtStage?: string | null;
  requirements?: string | null;
  notesContent?: string | null;
  notesImages?: string[];
  imageUrl?: string | null;
  cvName?: string | null;
  cvUrl?: string | null;
  cvText?: string | null;
  portfolioName?: string | null;
  portfolioUrl?: string | null;
  coverLetterName?: string | null;
  coverLetterUrl?: string | null;
  coverLetterText?: string | null;
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

  async findWithFiltersAndCount(
    userId: string,
    params: ApplicationFilterParams,
    tx?: Prisma.TransactionClient,
  ): Promise<{ data: Application[]; total: number }> {
    const {
      status,
      companyId,
      source,
      deadlineBefore,
      deadlineAfter,
      search,
      page = 1,
      limit = 20,
      sortBy = 'appliedAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.ApplicationWhereInput = {
      userId,
      ...(status && {
        status:
          status === ApplicationStatus.ASSESSMENT || status === ApplicationStatus.SCREENING
            ? { in: [ApplicationStatus.ASSESSMENT, ApplicationStatus.SCREENING] }
            : status === ApplicationStatus.HR_INTERVIEW || status === ApplicationStatus.INTERVIEWING
              ? { in: [ApplicationStatus.HR_INTERVIEW, ApplicationStatus.INTERVIEWING] }
              : status,
      }),
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

    const takeNum = Number(limit);
    const pageNum = Number(page);
    const skip = takeNum > 0 ? (pageNum - 1) * takeNum : undefined;
    const take = takeNum > 0 ? takeNum : undefined;

    const delegate = this.getDelegate(tx);
    const [data, total] = await Promise.all([
      delegate.findMany({
        where,
        select: {
          id: true,
          userId: true,
          companyId: true,
          jobTitle: true,
          applicationCode: true,
          status: true,
          rejectedAtStage: true,
          workMode: true,
          source: true,
          salaryMin: true,
          salaryMax: true,
          currency: true,
          sourceUrl: true,
          location: true,
          deadline: true,
          appliedAt: true,
          lastStatusChangedAt: true,
          createdAt: true,
          updatedAt: true,
          cvName: true,
          portfolioName: true,
          coverLetterName: true,
          imageUrl: true,
          requirements: true,
          notes: true,
          company: {
            select: { id: true, name: true },
          },
        },
        ...(skip !== undefined && { skip }),
        ...(take !== undefined && { take }),
        orderBy: sortBy === 'appliedAt'
          ? [{ appliedAt: sortOrder as Prisma.SortOrder }, { createdAt: sortOrder as Prisma.SortOrder }]
          : { [sortBy]: sortOrder },
      }),
      delegate.count({ where }),
    ]);

    const mappedData = data.map((app: any) => {
      let imageUrl = app.imageUrl;
      if (imageUrl && imageUrl.startsWith('data:image/')) {
        imageUrl = `/api/v1/applications/${app.id}/image`;
      }
      return {
        ...app,
        imageUrl,
      };
    });

    return { data: mappedData as any, total };
  }

  async findWithFilters(
    userId: string,
    params: ApplicationFilterParams,
    tx?: Prisma.TransactionClient,
  ): Promise<Application[]> {
    const { data } = await this.findWithFiltersAndCount(userId, params, tx);
    return data;
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
      orderBy: { appliedAt: 'desc' },
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

  async findImageById(id: string): Promise<{ imageUrl?: string | null } | null> {
    return this.prisma.application.findUnique({
      where: { id },
      select: { imageUrl: true },
    });
  }
}
