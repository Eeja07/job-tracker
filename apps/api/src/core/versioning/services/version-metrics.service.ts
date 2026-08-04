import { Injectable, Logger, Optional } from '@nestjs/common';
import { Counter, Registry } from 'prom-client';

@Injectable()
export class VersionMetricsService {
  private readonly logger = new Logger(VersionMetricsService.name);

  public readonly apiVersionRequestsTotal: Counter<string>;
  public readonly deprecatedEndpointHitsTotal: Counter<string>;

  constructor(@Optional() private readonly registry?: Registry) {
    const reg = this.registry || new Registry();

    this.apiVersionRequestsTotal = new Counter({
      name: 'api_version_requests_total',
      help: 'Total number of API requests by API version',
      labelNames: ['version', 'path', 'method'],
      registers: [reg],
    });

    this.deprecatedEndpointHitsTotal = new Counter({
      name: 'deprecated_endpoint_hits_total',
      help: 'Total hits to deprecated API endpoints',
      labelNames: ['version', 'endpoint'],
      registers: [reg],
    });
  }
}
