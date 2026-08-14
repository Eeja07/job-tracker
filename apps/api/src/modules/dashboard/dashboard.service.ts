import { Injectable, Optional } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import { DashboardRepository } from '../../repositories/dashboard/dashboard.repository';
import { RedisService } from '../redis/redis.service';
import {
  DashboardMetricsDto,
  PipelineDistributionDto,
  TopCompanyDto,
  TopSourceDto,
  MonthlyTrendDto,
} from './dto/dashboard-metrics.dto';

const DASHBOARD_CACHE_TTL_SECONDS = 60;

@Injectable()
export class DashboardService {
  constructor(
    private readonly dashboardRepository: DashboardRepository,
    @Optional() private readonly redisService?: RedisService,
  ) {}

  async clearCache(userId?: string): Promise<void> {
    if (!this.redisService) return;
    if (userId) {
      await this.redisService.del(`dashboard:metrics:${userId}`);
    } else {
      await this.redisService.delByPattern('dashboard:metrics:*');
    }
  }

  async getMetrics(userId: string): Promise<DashboardMetricsDto> {
    const cacheKey = `dashboard:metrics:${userId}`;

    if (this.redisService) {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          // Ignore JSON parse error and re-fetch
        }
      }
    }

    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      statusBreakdown,
      monthlyCounts,
      topSources,
      topCompanies,
      offerDates,
      trendApps,
    ] = await Promise.all([
      this.dashboardRepository.getStatusBreakdown(userId),
      this.dashboardRepository.getMonthlyCounts(
        userId,
        startOfThisMonth,
        startOfLastMonth,
      ),
      this.dashboardRepository.getTopSources(userId, 5),
      this.dashboardRepository.getTopCompanies(userId, 5),
      this.dashboardRepository.getOfferApplicationDates(userId),
      this.dashboardRepository.getRecentApplicationsForTrend(userId, 200),
    ]);

    // Pipeline Distribution
    const pipelineDistribution: PipelineDistributionDto = {
      SAVED: 0,
      APPLIED: 0,
      ASSESSMENT: 0,
      HR_INTERVIEW: 0,
      USER_INTERVIEW: 0,
      SCREENING: 0,
      INTERVIEWING: 0,
      OFFER: 0,
      REJECTED: 0,
      WITHDRAWN: 0,
    };

    let totalApplications = 0;
    for (const item of statusBreakdown) {
      if (item.status in pipelineDistribution) {
        pipelineDistribution[item.status] = item.count;
      }
      totalApplications += item.count;
    }

    // Rates
    const offerRate =
      totalApplications > 0
        ? Number(
            ((pipelineDistribution.OFFER / totalApplications) * 100).toFixed(2),
          )
        : 0;

    const interviewCount =
      pipelineDistribution.INTERVIEWING +
      pipelineDistribution.HR_INTERVIEW +
      pipelineDistribution.USER_INTERVIEW +
      pipelineDistribution.ASSESSMENT +
      pipelineDistribution.SCREENING +
      pipelineDistribution.OFFER;
    const interviewRate =
      totalApplications > 0
        ? Number(((interviewCount / totalApplications) * 100).toFixed(2))
        : 0;

    // Average days to offer
    let averageDaysToOffer = 0;
    if (offerDates.length > 0) {
      const totalDays = offerDates.reduce((acc, curr) => {
        const diffMs =
          curr.lastStatusChangedAt.getTime() - curr.appliedAt.getTime();
        const diffDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
        return acc + diffDays;
      }, 0);
      averageDaysToOffer = Number((totalDays / offerDates.length).toFixed(1));
    }

    // Top Companies & Sources mapping
    const mappedTopCompanies: TopCompanyDto[] = topCompanies.map((c) => ({
      companyId: c.companyId,
      companyName: c.companyName,
      count: c.count,
    }));

    const mappedTopSources: TopSourceDto[] = topSources.map((s) => ({
      source: s.source,
      count: s.count,
    }));

    // Monthly Trend calculation
    const monthlyMap = new Map<string, number>();
    for (const app of trendApps) {
      const yearMonth = app.appliedAt.toISOString().substring(0, 7);
      monthlyMap.set(yearMonth, (monthlyMap.get(yearMonth) || 0) + 1);
    }

    const monthlyTrend: MonthlyTrendDto[] = Array.from(monthlyMap.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const result: DashboardMetricsDto = {
      totalApplications,
      pipelineDistribution,
      applicationsThisMonth: monthlyCounts.thisMonth,
      applicationsLastMonth: monthlyCounts.lastMonth,
      offerRate,
      interviewRate,
      averageDaysToOffer,
      topCompanies: mappedTopCompanies,
      topSources: mappedTopSources,
      monthlyTrend,
    };

    if (this.redisService) {
      await this.redisService.set(
        cacheKey,
        JSON.stringify(result),
        DASHBOARD_CACHE_TTL_SECONDS,
      );
    }

    return result;
  }
}
