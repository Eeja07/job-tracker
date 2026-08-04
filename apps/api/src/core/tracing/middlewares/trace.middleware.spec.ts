import { TraceMiddleware } from './trace.middleware';
import { RequestWithTraceContext } from './trace.middleware';
import { Response } from 'express';

describe('TraceMiddleware', () => {
  let middleware: TraceMiddleware;
  let mockTracingService: any;
  let mockContextService: any;

  beforeEach(() => {
    mockTracingService = {
      generateTraceId: jest.fn().mockReturnValue('1234567890abcdef1234567890abcdef'),
      generateSpanId: jest.fn().mockReturnValue('1234567890abcdef'),
      shouldSample: jest.fn().mockReturnValue(true),
    };

    mockContextService = {
      run: jest.fn((store, fn) => fn()),
    };

    middleware = new TraceMiddleware(mockTracingService, mockContextService);
  });

  it('should extract or generate trace headers and call next()', () => {
    const req = {
      headers: {},
      method: 'GET',
      url: '/api/v1/applications',
    } as unknown as RequestWithTraceContext;

    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;

    const next = jest.fn();

    middleware.use(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Trace-Id', expect.any(String));
    expect(res.setHeader).toHaveBeenCalledWith('X-Span-Id', expect.any(String));
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', expect.any(String));
    expect(next).toHaveBeenCalled();
  });
});
