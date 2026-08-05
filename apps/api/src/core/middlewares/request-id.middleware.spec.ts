import { Response, NextFunction } from 'express';
import { RequestIdMiddleware, RequestWithId } from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
  });

  it('should reuse existing X-Request-ID header if present', () => {
    const req = {
      headers: { 'x-request-id': 'existing-uuid-1234' },
    } as unknown as RequestWithId;

    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;

    const next: NextFunction = jest.fn();

    middleware.use(req, res, next);

    expect(req.id).toBe('existing-uuid-1234');
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      'existing-uuid-1234',
    );
    expect(next).toHaveBeenCalled();
  });

  it('should generate new UUID if X-Request-ID is not present', () => {
    const req = {
      headers: {},
    } as unknown as RequestWithId;

    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;

    const next: NextFunction = jest.fn();

    middleware.use(req, res, next);

    expect(req.id).toBeDefined();
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.id);
    expect(next).toHaveBeenCalled();
  });
});
