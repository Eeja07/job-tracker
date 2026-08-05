import { Injectable } from '@nestjs/common';
import { ApplicationStatus, ApplicationSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface StatusCount {
  status: ApplicationStatus;
  count: number;
}

export interface SourceCount {
  source: ApplicationSource;
  count: number;
}

export interface CompanyCount {
  companyId: string;
  companyName: string;
  count: number;
}

export interface ApplicationDates {
  appliedAt: Date;
  lastStatusChangedAt: Date;
}

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getStatusBreakdown(userId: string): Promise<StatusCount[]> {
    const groups = await this.prisma.application.groupBy({
      by: ['status'],
      where: { userId },
      _count: {
        _all: true,
      },
    });

    return groups.map((g) => ({
      status: g.status,
      count: g._count._all,
    }));
  }

  async getMonthlyCounts(
    userId: string,
    startOfThisMonth: Date,
    startOfLastMonth: Date,
  ): Promise<{ thisMonth: number; lastMonth: number }> {
    const [thisMonth, lastMonth] = await Promise.all([
      this.prisma.application.count({
        where: {
          userId,
          appliedAt: { gte: startOfThisMonth },
        },
      }),
      this.prisma.application.count({
        where: {
          userId,
          appliedAt: {
            gte: startOfLastMonth,
            lt: startOfThisMonth,
          },
        },
      }),
    ]);

    return { thisMonth, lastMonth };
  }

  async getTopSources(userId: string, limit = 5): Promise<SourceCount[]> {
    const groups = await this.prisma.application.groupBy({
      by: ['source'],
      where: { userId, source: { not: null } },
      _count: {
        _all: true,
      },
      orderBy: {
        _count: {
          source: 'desc',
        },
      },
      take: limit,
    });

    return groups
      .filter((g) => g.source !== null)
      .map((g) => ({
        source: g.source as ApplicationSource,
        count: g._count._all,
      }));
  }

  async getTopCompanies(userId: string, limit = 5): Promise<CompanyCount[]> {
    const groups = await this.prisma.application.groupBy({
      by: ['companyId'],
      where: { userId, companyId: { not: null } },
      _count: {
        _all: true,
      },
      orderBy: {
        _count: {
          companyId: 'desc',
        },
      },
      take: limit,
    });

    const companyIds = groups
      .map((g) => g.companyId)
      .filter((id): id is string => id !== null);

    if (companyIds.length === 0) return [];

    const companies = await this.prisma.company.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, name: true },
    });

    const companyMap = new Map(companies.map((c) => [c.id, c.name]));

    return groups
      .filter((g) => g.companyId !== null)
      .map((g) => ({
        companyId: g.companyId as string,
        companyName: companyMap.get(g.companyId as string) || 'Unknown Company',
        count: g._count._all,
      }));
  }

  async getOfferApplicationDates(userId: string): Promise<ApplicationDates[]> {
    return this.prisma.application.findMany({
      where: { userId, status: ApplicationStatus.OFFER },
      select: { appliedAt: true, lastStatusChangedAt: true },
    });
  }

  async getRecentApplicationsForTrend(
    userId: string,
    limit = 200,
  ): Promise<{ appliedAt: Date }[]> {
    return this.prisma.application.findMany({
      where: { userId },
      select: { appliedAt: true },
      orderBy: { appliedAt: 'desc' },
      take: limit,
    });
  }
}
