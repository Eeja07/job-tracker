import { IQuery, IQueryHandler } from '../interfaces/query.interface';
import { Injectable } from '@nestjs/common';
import { ReadModelService } from '../services/read-model.service';
import {
  CompaniesReadModel,
  CompanyReadModelItem,
  SearchReadModel,
} from '../interfaces/read-models.interface';
import { PrismaService } from '../../../prisma/prisma.service';

export interface GetCompanyQuery extends IQuery {
  queryName: 'GetCompany';
  companyId: string;
}

export interface ListCompaniesQuery extends IQuery {
  queryName: 'ListCompanies';
  page?: number;
  limit?: number;
}

export interface SearchCompaniesQuery extends IQuery {
  queryName: 'SearchCompanies';
  searchTerm: string;
}

@Injectable()
export class GetCompanyHandler implements IQueryHandler<
  GetCompanyQuery,
  CompanyReadModelItem | null
> {
  readonly queryName = 'GetCompany';

  constructor(
    private readonly readModelService: ReadModelService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: GetCompanyQuery): Promise<CompanyReadModelItem | null> {
    const cacheKey = `companies:${query.companyId}`;
    const cached = await this.readModelService.get<CompanyReadModelItem>(
      cacheKey,
      'GetCompany',
    );
    if (cached) return cached;

    const company = await this.prisma.company.findUnique({
      where: { id: query.companyId },
      include: { _count: { select: { applications: true } } },
    });

    if (!company) return null;

    const item: CompanyReadModelItem = {
      id: company.id,
      name: company.name,
      website: company.website || undefined,
      applicationCount: company._count.applications,
      createdAt: company.createdAt.toISOString(),
    };

    await this.readModelService.set(cacheKey, item, 60);
    return item;
  }
}

@Injectable()
export class ListCompaniesHandler implements IQueryHandler<
  ListCompaniesQuery,
  CompaniesReadModel
> {
  readonly queryName = 'ListCompanies';

  constructor(
    private readonly readModelService: ReadModelService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: ListCompaniesQuery): Promise<CompaniesReadModel> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const cacheKey = `companies:page:${page}:limit:${limit}`;

    const cached = await this.readModelService.get<CompaniesReadModel>(
      cacheKey,
      'ListCompanies',
    );
    if (cached) return cached;

    const [companies, total] = await Promise.all([
      this.prisma.company.findMany({
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { applications: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.company.count(),
    ]);

    const items: CompanyReadModelItem[] = companies.map((c) => ({
      id: c.id,
      name: c.name,
      website: c.website || undefined,
      applicationCount: c._count.applications,
      createdAt: c.createdAt.toISOString(),
    }));

    const result: CompaniesReadModel = { items, total };
    await this.readModelService.set(cacheKey, result, 60);
    return result;
  }
}

@Injectable()
export class SearchCompaniesHandler implements IQueryHandler<
  SearchCompaniesQuery,
  SearchReadModel
> {
  readonly queryName = 'SearchCompanies';

  constructor(
    private readonly readModelService: ReadModelService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: SearchCompaniesQuery): Promise<SearchReadModel> {
    const cacheKey = `search:companies:${encodeURIComponent(query.searchTerm)}`;
    const cached = await this.readModelService.get<SearchReadModel>(
      cacheKey,
      'SearchCompanies',
    );
    if (cached) return cached;

    const companies = await this.prisma.company.findMany({
      where: {
        name: { contains: query.searchTerm, mode: 'insensitive' },
      },
      include: { _count: { select: { applications: true } } },
    });

    const items: CompanyReadModelItem[] = companies.map((c) => ({
      id: c.id,
      name: c.name,
      website: c.website || undefined,
      applicationCount: c._count.applications,
      createdAt: c.createdAt.toISOString(),
    }));

    const result: SearchReadModel = {
      query: query.searchTerm,
      applications: [],
      companies: items,
      totalMatches: items.length,
    };

    await this.readModelService.set(cacheKey, result, 60);
    return result;
  }
}
