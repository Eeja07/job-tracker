import { FEATURE_FLAG_KEY, FeatureFlag } from './feature-flag.decorator';

describe('FeatureFlag Decorator', () => {
  class TestClass {
    @FeatureFlag('TEST_FEATURE')
    testMethod() {}
  }

  it('should set FEATURE_FLAG_KEY metadata on decorated method', () => {
    const metadata = Reflect.getMetadata(FEATURE_FLAG_KEY, TestClass.prototype.testMethod);
    expect(metadata).toBe('TEST_FEATURE');
  });
});
