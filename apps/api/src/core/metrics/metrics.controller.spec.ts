import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  let controller: MetricsController;
  let service: jest.Mocked<MetricsService>;

  beforeEach(async () => {
    const mockService = {
      contentType: 'text/plain; version=0.0.4',
      getMetrics: jest.fn().mockResolvedValue('# HELP active_requests Active requests\nactive_requests 0\n'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [{ provide: MetricsService, useValue: mockService }],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
    service = module.get(MetricsService);
  });

  describe('getMetrics', () => {
    it('should set Content-Type header and return Prometheus metrics text', async () => {
      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      await controller.getMetrics(mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', service.contentType);
      expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('active_requests'));
    });
  });
});
