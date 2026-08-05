import { IQuery, IQueryHandler } from '../interfaces/query.interface';
import { Injectable } from '@nestjs/common';
import { ReadModelService } from '../services/read-model.service';
import {
  RecentJobsReadModel,
  StatisticsReadModel,
} from '../interfaces/read-models.interface';
import { PrismaService } from '../../../prisma/prisma.service';

export interface StatisticsQuery extends IQuery {
  queryName: 'Statistics';
}

export interface GetRecentJobsQuery extends IQuery {
  queryName: 'GetRecentJobs';
  userId: string;
  limit?: number;
}

@Injectable()
export class StatisticsHandler implements IQueryHandler<
  StatisticsQuery,
  StatisticsReadModel
> {
  readonly queryName = 'Statistics';

  constructor(
    private readonly readModelService: ReadModelService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: StatisticsQuery): Promise<StatisticsReadModel> {
    const cacheKey = 'statistics:global';
    const cached = await this.readModelService.get<StatisticsReadModel>(
      cacheKey,
      'Statistics',
    );
    if (cached) return cached;

    const [totalUsers, totalApplications, totalCompanies, totalAttachments] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.application.count(),
        this.prisma.company.count(),
        this.prisma.attachment.count(),
      ]);

    const result: StatisticsReadModel = {
      totalUsers,
      totalApplications,
      totalCompanies,
      totalAttachments,
      statusBreakdown: {},
      generatedAt: new Date().toISOString(),
    };

    await this.readModelService.set(cacheKey, result, 60);
    return result;
  }
}

@Injectable()
export class GetRecentJobsHandler implements IQueryHandler<
  GetRecentJobsQuery,
  RecentJobsReadModel
> {
  readonly queryName = 'GetRecentJobs';

  constructor(
    private readonly readModelService: ReadModelService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: GetRecentJobsQuery): Promise<RecentJobsReadModel> {
    const limit = query.limit || 5;
    const cacheKey = `recent_jobs:${query.userId}:l${limit}`;

    const cached = await this.readModelService.get<RecentJobsReadModel>(
      cacheKey,
      'GetRecentJobs',
    );
    if (cached) return cached;

    const apps = await this.prisma.application.findMany({
      where: { userId: query.userId },
      include: { company: true },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const jobs = apps.map((a) => ({
      id: a.id,
      title: a.jobTitle,
      companyName: a.company?.name || 'Unknown',
      status: a.status,
      createdAt: a.createdAt.toISOString(),
    }));

    const result: RecentJobsReadModel = { jobs, total: jobs.length };
    await this.readModelService.set(cacheKey, result, 60);
    return result;
  }
}
