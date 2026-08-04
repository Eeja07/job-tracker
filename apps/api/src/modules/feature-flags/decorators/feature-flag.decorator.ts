import { SetMetadata } from '@nestjs/common';

export const FEATURE_FLAG_KEY = 'FEATURE_FLAG_KEY';

/**
 * Decorator to enforce that an endpoint is protected by a feature flag.
 * If the feature flag is disabled or not found, FeatureFlagGuard will return 404 Not Found.
 *
 * Usage: `@FeatureFlag('NEW_DASHBOARD_UI')`
 */
export const FeatureFlag = (key: string) => SetMetadata(FEATURE_FLAG_KEY, key);
