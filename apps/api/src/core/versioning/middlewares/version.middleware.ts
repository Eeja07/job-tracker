import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface RequestWithApiVersion extends Request {
  apiVersion?: string;
}

export function applyVersionMiddleware(req: RequestWithApiVersion, res: Response, next: NextFunction): void {
  let extractedVersion: string | null = null;

  // 1. Extract from Header (X-API-Version or Api-Version)
  const headerVer = (req.headers['x-api-version'] || req.headers['api-version']) as string;
  if (headerVer) {
    extractedVersion = headerVer.replace(/^v/i, '').trim();
  }

  // 2. Extract from Accept / Media Type Header (e.g. application/json;version=2)
  if (!extractedVersion) {
    const acceptHeader = req.headers['accept'] as string;
    if (acceptHeader) {
      const matchVersionParam = acceptHeader.match(/version=([0-9]+)/i) || acceptHeader.match(/\.v([0-9]+)\+/i);
      if (matchVersionParam) {
        extractedVersion = matchVersionParam[1];
      }
    }
  }

  // 3. Extract from URI Path if explicit (e.g. /api/v1/..., /api/v2/...)
  if (!extractedVersion) {
    const uriMatch = req.url?.match(/\/v([0-9]+)(\/|$)/i) || req.originalUrl?.match(/\/v([0-9]+)(\/|$)/i);
    if (uriMatch) {
      extractedVersion = uriMatch[1];
    }
  }

  // 4. Default version fallback if unversioned
  const finalVersion = extractedVersion || '1';
  req.apiVersion = finalVersion;

  // 5. Rewrite unversioned URL before router matching (except docs & metrics)
  if (
    req.url &&
    !req.url.startsWith('/api/docs') &&
    !req.url.startsWith('/docs') &&
    !req.url.match(/\/api\/v[0-9]+(\/|$)/i) &&
    req.url.startsWith('/api/')
  ) {
    const subPath = req.url.slice(5);
    req.url = `/api/v${finalVersion}/${subPath}`;
  }

  next();
}

@Injectable()
export class VersionMiddleware implements NestMiddleware {
  use(req: RequestWithApiVersion, res: Response, next: NextFunction): void {
    applyVersionMiddleware(req, res, next);
  }
}
