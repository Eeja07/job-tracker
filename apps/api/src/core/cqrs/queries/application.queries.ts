import { IQuery, IQueryHandler } from '../interfaces/query.interface';
import { Injectable } from '@nestjs/common';
import { ReadModelService } from '../services/read-model.service';
import {
  ApplicationReadModelItem,
  ApplicationsReadModel,
  SearchReadModel,
} from '../interfaces/read-models.interface';
import { PrismaService } from '../../../prisma/prisma.service';

export interface GetApplicationQuery extends IQuery {
  queryName: 'GetApplication';
  applicationId: string;
  userId: string;
}

export interface ListApplicationsQuery extends IQuery {
  queryName: 'ListApplications';
  userId: string;
  page?: number;
  limit?: number;
}

export interface SearchApplicationsQuery extends IQuery {
  queryName: 'SearchApplications';
  userId: string;
  searchTerm: string;
}

@Injectable()
export class GetApplicationHandler implements IQueryHandler<
  GetApplicationQuery,
  ApplicationReadModelItem | null
> {
  readonly queryName = 'GetApplication';

  constructor(
    private readonly readModelService: ReadModelService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    query: GetApplicationQuery,
  ): Promise<ApplicationReadModelItem | null> {
    const cacheKey = `applications:${query.applicationId}`;
    const cached = await this.readModelService.get<ApplicationReadModelItem>(
      cacheKey,
      'GetApplication',
    );
    if (cached) return cached;

    const app = await this.prisma.application.findFirst({
      where: { id: query.applicationId, userId: query.userId },
      include: { company: true },
    });

    if (!app) return null;

    const item: ApplicationReadModelItem = {
      id: app.id,
      userId: app.userId,
      companyId: app.companyId,
      companyName: app.company?.name,
      title: app.jobTitle,
      status: app.status,
      appliedDate: app.appliedAt?.toISOString(),
      createdAt: app.createdAt.toISOString(),
      updatedAt: app.updatedAt.toISOString(),
    };

    await this.readModelService.set(cacheKey, item, 60);
    return item;
  }
}

@Injectable()
export class ListApplicationsHandler implements IQueryHandler<
  ListApplicationsQuery,
  ApplicationsReadModel
> {
  readonly queryName = 'ListApplications';

  constructor(
    private readonly readModelService: ReadModelService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: ListApplicationsQuery): Promise<ApplicationsReadModel> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const cacheKey = `applications:user:${query.userId}:p${page}:l${limit}`;

    const cached = await this.readModelService.get<ApplicationsReadModel>(
      cacheKey,
      'ListApplications',
    );
    if (cached) return cached;

    const [apps, total] = await Promise.all([
      this.prisma.application.findMany({
        where: { userId: query.userId },
        include: { company: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.application.count({ where: { userId: query.userId } }),
    ]);

    const items: ApplicationReadModelItem[] = apps.map((app) => ({
      id: app.id,
      userId: app.userId,
      companyId: app.companyId,
      companyName: app.company?.name,
      title: app.jobTitle,
      status: app.status,
      appliedDate: app.appliedAt?.toISOString(),
      createdAt: app.createdAt.toISOString(),
      updatedAt: app.updatedAt.toISOString(),
    }));

    const result: ApplicationsReadModel = { items, total };
    await this.readModelService.set(cacheKey, result, 60);
    return result;
  }
}

@Injectable()
export class SearchApplicationsHandler implements IQueryHandler<
  SearchApplicationsQuery,
  SearchReadModel
> {
  readonly queryName = 'SearchApplications';

  constructor(
    private readonly readModelService: ReadModelService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: SearchApplicationsQuery): Promise<SearchReadModel> {
    const cacheKey = `search:applications:${query.userId}:${encodeURIComponent(query.searchTerm)}`;
    const cached = await this.readModelService.get<SearchReadModel>(
      cacheKey,
      'SearchApplications',
    );
    if (cached) return cached;

    const apps = await this.prisma.application.findMany({
      where: {
        userId: query.userId,
        jobTitle: { contains: query.searchTerm, mode: 'insensitive' },
      },
      include: { company: true },
    });

    const items: ApplicationReadModelItem[] = apps.map((app) => ({
      id: app.id,
      userId: app.userId,
      companyId: app.companyId,
      companyName: app.company?.name,
      title: app.jobTitle,
      status: app.status,
      appliedDate: app.appliedAt?.toISOString(),
      createdAt: app.createdAt.toISOString(),
      updatedAt: app.updatedAt.toISOString(),
    }));

    const result: SearchReadModel = {
      query: query.searchTerm,
      applications: items,
      companies: [],
      totalMatches: items.length,
    };

    await this.readModelService.set(cacheKey, result, 60);
    return result;
  }
}
