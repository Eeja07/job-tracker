import { SetMetadata, applyDecorators } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

export const API_VERSION_KEY = 'apiVersion';

/**
 * Decorator to specify API version(s) for a controller or route handler.
 * Combines version metadata with OpenAPI tagging.
 */
export function ApiVersion(version: string | string[]) {
  const versions = Array.isArray(version) ? version : [version];
  return applyDecorators(
    SetMetadata(API_VERSION_KEY, versions),
    ApiTags(`API v${versions.join(', v')}`),
  );
}
