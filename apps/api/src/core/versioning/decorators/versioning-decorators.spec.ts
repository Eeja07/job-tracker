import { ApiVersion } from './api-version.decorator';
import { DeprecatedEndpoint, DEPRECATED_ENDPOINT_KEY } from './deprecated-endpoint.decorator';
import { Reflector } from '@nestjs/core';

describe('Versioning Decorators', () => {
  const reflector = new Reflector();

  it('should apply DeprecatedEndpoint metadata correctly', () => {
    @DeprecatedEndpoint({ sunsetDate: '2025-12-31' })
    class TestClass {}

    const meta = reflector.get(DEPRECATED_ENDPOINT_KEY, TestClass);
    expect(meta).toBeDefined();
    expect(meta.isDeprecated).toBe(true);
    expect(meta.sunsetDate).toBe('2025-12-31');
  });
});
