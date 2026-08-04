import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
    service.onModuleInit();
  });

  it('should initialize registry and counters', async () => {
    expect(service.httpRequestsTotal).toBeDefined();
    expect(service.httpRequestDurationSeconds).toBeDefined();
    expect(service.activeRequests).toBeDefined();
    expect(service.contentType).toContain('text/plain');
  });

  it('should return metrics formatted string', async () => {
    service.activeRequests.inc();
    const metrics = await service.getMetrics();
    expect(metrics).toContain('active_requests');
    expect(metrics).toContain('http_requests_total');
  });
});
