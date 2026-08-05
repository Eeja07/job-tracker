import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationStatus, ApplicationSource } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { DashboardRepository } from '../../repositories/dashboard/dashboard.repository';

describe('DashboardService', () => {
  let service: DashboardService;
  let repository: jest.Mocked<DashboardRepository>;

  beforeEach(async () => {
    const mockRepo = {
      getStatusBreakdown: jest.fn(),
      getMonthlyCounts: jest.fn(),
      getTopSources: jest.fn(),
      getTopCompanies: jest.fn(),
      getOfferApplicationDates: jest.fn(),
      getRecentApplicationsForTrend: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: DashboardRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    repository = module.get(DashboardRepository);
  });

  describe('getMetrics', () => {
    it('should compute and return complete dashboard analytics', async () => {
      repository.getStatusBreakdown.mockResolvedValue([
        { status: ApplicationStatus.SAVED, count: 5 },
        { status: ApplicationStatus.APPLIED, count: 10 },
        { status: ApplicationStatus.INTERVIEWING, count: 3 },
        { status: ApplicationStatus.OFFER, count: 2 },
      ]);

      repository.getMonthlyCounts.mockResolvedValue({
        thisMonth: 12,
        lastMonth: 8,
      });

      repository.getTopSources.mockResolvedValue([
        { source: ApplicationSource.LINKEDIN, count: 12 },
      ]);

      repository.getTopCompanies.mockResolvedValue([
        { companyId: 'company-1', companyName: 'Tokopedia', count: 4 },
      ]);

      const appliedDate = new Date('2026-08-01T00:00:00Z');
      const offerDate = new Date('2026-08-11T00:00:00Z'); // 10 days
      repository.getOfferApplicationDates.mockResolvedValue([
        { appliedAt: appliedDate, lastStatusChangedAt: offerDate },
      ]);

      repository.getRecentApplicationsForTrend.mockResolvedValue([
        { appliedAt: new Date('2026-08-01T00:00:00Z') },
        { appliedAt: new Date('2026-08-05T00:00:00Z') },
        { appliedAt: new Date('2026-07-15T00:00:00Z') },
      ]);

      const metrics = await service.getMetrics('user-uuid-1');

      expect(metrics.totalApplications).toBe(20);
      expect(metrics.pipelineDistribution.SAVED).toBe(5);
      expect(metrics.pipelineDistribution.APPLIED).toBe(10);
      expect(metrics.pipelineDistribution.INTERVIEWING).toBe(3);
      expect(metrics.pipelineDistribution.OFFER).toBe(2);

      expect(metrics.applicationsThisMonth).toBe(12);
      expect(metrics.applicationsLastMonth).toBe(8);

      expect(metrics.offerRate).toBe(10); // 2 / 20 * 100
      expect(metrics.interviewRate).toBe(25); // (3 + 2) / 20 * 100
      expect(metrics.averageDaysToOffer).toBe(10);

      expect(metrics.topCompanies).toEqual([
        { companyId: 'company-1', companyName: 'Tokopedia', count: 4 },
      ]);
      expect(metrics.topSources).toEqual([
        { source: ApplicationSource.LINKEDIN, count: 12 },
      ]);
      expect(metrics.monthlyTrend).toEqual([
        { month: '2026-07', count: 1 },
        { month: '2026-08', count: 2 },
      ]);
    });

    it('should return 0 rates when user has zero applications', async () => {
      repository.getStatusBreakdown.mockResolvedValue([]);
      repository.getMonthlyCounts.mockResolvedValue({
        thisMonth: 0,
        lastMonth: 0,
      });
      repository.getTopSources.mockResolvedValue([]);
      repository.getTopCompanies.mockResolvedValue([]);
      repository.getOfferApplicationDates.mockResolvedValue([]);
      repository.getRecentApplicationsForTrend.mockResolvedValue([]);

      const metrics = await service.getMetrics('user-uuid-1');

      expect(metrics.totalApplications).toBe(0);
      expect(metrics.offerRate).toBe(0);
      expect(metrics.interviewRate).toBe(0);
      expect(metrics.averageDaysToOffer).toBe(0);
      expect(metrics.monthlyTrend).toEqual([]);
    });
  });
});
