import { IQuery, IQueryHandler } from '../interfaces/query.interface';
import { Injectable } from '@nestjs/common';
import { ReadModelService } from '../services/read-model.service';
import { ActivityTimelineReadModel } from '../interfaces/read-models.interface';
import { PrismaService } from '../../../prisma/prisma.service';

export interface ActivityTimelineQuery extends IQuery {
  queryName: 'ActivityTimeline';
  userId?: string;
  limit?: number;
}

@Injectable()
export class ActivityTimelineHandler implements IQueryHandler<
  ActivityTimelineQuery,
  ActivityTimelineReadModel
> {
  readonly queryName = 'ActivityTimeline';

  constructor(
    private readonly readModelService: ReadModelService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    query: ActivityTimelineQuery,
  ): Promise<ActivityTimelineReadModel> {
    const limit = query.limit || 20;
    const cacheKey = `activity_timeline:${query.userId || 'global'}:l${limit}`;

    const cached = await this.readModelService.get<ActivityTimelineReadModel>(
      cacheKey,
      'ActivityTimeline',
    );
    if (cached) return cached;

    const auditLogs = await this.prisma.auditLog.findMany({
      where: query.userId ? { userId: query.userId } : undefined,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const activities = auditLogs.map((log) => ({
      id: log.id,
      eventType: log.action,
      userId: log.userId || undefined,
      details: {
        resource: log.resource,
        resourceId: log.resourceId,
      },
      timestamp: log.createdAt.toISOString(),
    }));

    const result: ActivityTimelineReadModel = {
      activities,
      total: activities.length,
    };

    await this.readModelService.set(cacheKey, result, 60);
    return result;
  }
}
