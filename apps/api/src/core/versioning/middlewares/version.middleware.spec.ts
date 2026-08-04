import { VersionMiddleware } from './version.middleware';
import { Response } from 'express';

describe('VersionMiddleware', () => {
  let middleware: VersionMiddleware;

  beforeEach(() => {
    middleware = new VersionMiddleware();
  });

  it('should default version to "1" if no header or media type provided', () => {
    const req: any = { headers: {}, url: '/api/applications', originalUrl: '/api/applications' };
    const res = {} as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.apiVersion).toBe('1');
    expect(next).toHaveBeenCalled();
  });

  it('should extract version from X-API-Version header and rewrite URL', () => {
    const req: any = { headers: { 'x-api-version': '2' }, url: '/api/applications', originalUrl: '/api/applications' };
    const res = {} as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.apiVersion).toBe('2');
    expect(req.url).toBe('/api/v2/applications');
    expect(next).toHaveBeenCalled();
  });

  it('should extract version from Accept media type header', () => {
    const req: any = {
      headers: { accept: 'application/json;version=2' },
      url: '/api/applications',
      originalUrl: '/api/applications',
    };
    const res = {} as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.apiVersion).toBe('2');
    expect(req.url).toBe('/api/v2/applications');
    expect(next).toHaveBeenCalled();
  });
});
