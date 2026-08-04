import { IQuery, IQueryHandler } from '../interfaces/query.interface';
import { Injectable } from '@nestjs/common';
import { ReadModelService } from '../services/read-model.service';
import { DashboardReadModel } from '../interfaces/read-models.interface';
import { PrismaService } from '../../../prisma/prisma.service';

export interface GetDashboardQuery extends IQuery {
  queryName: 'GetDashboard';
  userId: string;
}

@Injectable()
export class GetDashboardHandler implements IQueryHandler<GetDashboardQuery, DashboardReadModel> {
  readonly queryName = 'GetDashboard';

  constructor(
    private readonly readModelService: ReadModelService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: GetDashboardQuery): Promise<DashboardReadModel> {
    const cacheKey = `dashboard:${query.userId}`;
    const cached = await this.readModelService.get<DashboardReadModel>(cacheKey, 'GetDashboard');
    if (cached) return cached;

    // Build projection from DB if cache miss
    const totalApplications = await this.prisma.application.count({ where: { userId: query.userId } });

    const model: DashboardReadModel = {
      totalApplications,
      activeApplications: totalApplications,
      interviewsScheduled: 0,
      offersReceived: 0,
      rejections: 0,
      lastUpdated: new Date().toISOString(),
    };

    await this.readModelService.set(cacheKey, model, 60);
    return model;
  }
}
