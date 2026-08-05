import { VersionDeprecationInterceptor } from './version-deprecation.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('VersionDeprecationInterceptor', () => {
  let interceptor: VersionDeprecationInterceptor;
  let mockReflector: any;
  let mockMetrics: any;

  beforeEach(() => {
    mockReflector = {
      get: jest.fn(),
    };
    mockMetrics = {
      apiVersionRequestsTotal: { inc: jest.fn() },
      deprecatedEndpointHitsTotal: { inc: jest.fn() },
    };
    interceptor = new VersionDeprecationInterceptor(mockReflector, mockMetrics);
  });

  it('should inject Deprecation and Sunset headers for deprecated endpoints', (done) => {
    mockReflector.get.mockReturnValue({
      isDeprecated: true,
      sunsetDate: 'Sun, 01 Dec 2025 00:00:00 GMT',
      infoUrl: '/docs/v1',
    });

    const setHeaderMock = jest.fn();
    const mockContext: any = {
      switchToHttp: () => ({
        getRequest: () => ({
          apiVersion: '1',
          url: '/api/v1/applications',
          method: 'GET',
        }),
        getResponse: () => ({ setHeader: setHeaderMock }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };

    const next: CallHandler = { handle: () => of('data') };

    interceptor
      .intercept(mockContext as ExecutionContext, next)
      .subscribe(() => {
        expect(setHeaderMock).toHaveBeenCalledWith('Deprecation', 'true');
        expect(setHeaderMock).toHaveBeenCalledWith(
          'Sunset',
          'Sun, 01 Dec 2025 00:00:00 GMT',
        );
        expect(setHeaderMock).toHaveBeenCalledWith(
          'Link',
          '</docs/v1>; rel="deprecation"',
        );
        expect(mockMetrics.deprecatedEndpointHitsTotal.inc).toHaveBeenCalled();
        done();
      });
  });
});
