import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardMetricsDto } from './dto/dashboard-metrics.dto';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: jest.Mocked<DashboardService>;

  const mockReq = {
    user: { sub: 'user-uuid-1', email: 'test@example.com' },
  };

  const mockMetrics: DashboardMetricsDto = {
    totalApplications: 10,
    pipelineDistribution: {
      SAVED: 2,
      APPLIED: 5,
      SCREENING: 1,
      INTERVIEWING: 1,
      OFFER: 1,
      REJECTED: 0,
      WITHDRAWN: 0,
    },
    applicationsThisMonth: 6,
    applicationsLastMonth: 4,
    offerRate: 10,
    interviewRate: 20,
    averageDaysToOffer: 12,
    topCompanies: [],
    topSources: [],
    monthlyTrend: [],
  };

  beforeEach(async () => {
    const mockService = {
      getMetrics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: mockService }],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
    service = module.get(DashboardService);
  });

  describe('getMetrics', () => {
    it('should call service.getMetrics with userId and return metrics', async () => {
      service.getMetrics.mockResolvedValue(mockMetrics);

      const result = await controller.getMetrics(mockReq as any);

      expect(service.getMetrics).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toEqual(mockMetrics);
    });
  });
});
