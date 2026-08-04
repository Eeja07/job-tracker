import { TraceContextService } from './trace-context.service';

describe('TraceContextService', () => {
  let service: TraceContextService;

  beforeEach(() => {
    service = new TraceContextService();
  });

  it('should manage trace context in AsyncLocalStorage', () => {
    const store = {
      traceId: 'trace-123',
      spanId: 'span-456',
      requestId: 'req-789',
      correlationId: 'corr-000',
      sampled: true,
      attributes: {},
    };

    service.run(store, () => {
      expect(service.getTraceId()).toBe('trace-123');
      expect(service.getSpanId()).toBe('span-456');
      expect(service.getRequestId()).toBe('req-789');
      expect(service.getCorrelationId()).toBe('corr-000');

      service.setUserId('usr-999');
      expect(service.getStore()?.userId).toBe('usr-999');
    });

    expect(service.getTraceId()).toBeUndefined();
  });
});
