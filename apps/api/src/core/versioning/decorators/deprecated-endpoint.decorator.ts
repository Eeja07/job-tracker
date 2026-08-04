import { SetMetadata } from '@nestjs/common';

export const DEPRECATED_ENDPOINT_KEY = 'deprecatedEndpoint';

export interface DeprecatedOptions {
  sunsetDate?: string; // e.g. "Sun, 01 Dec 2025 00:00:00 GMT" or ISO string
  infoUrl?: string;    // e.g. "https://api.jobtracker.com/docs/deprecation/v1"
  reason?: string;
}

/**
 * Decorator to mark an endpoint or controller as deprecated (RFC 8594 compliant).
 * Automatically injects Deprecation and Sunset headers on responses.
 */
export function DeprecatedEndpoint(options: DeprecatedOptions = {}) {
  return SetMetadata(DEPRECATED_ENDPOINT_KEY, {
    isDeprecated: true,
    sunsetDate: options.sunsetDate || 'Sun, 01 Dec 2025 00:00:00 GMT',
    infoUrl: options.infoUrl || '/docs/v1',
    reason: options.reason || 'This API version is deprecated and will be sunset in the future.',
  });
}
