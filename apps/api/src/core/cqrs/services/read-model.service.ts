import { Injectable, Logger, Optional } from '@nestjs/common';
import { RedisService } from '../../../modules/redis/redis.service';
import { CqrsMetricsService } from './cqrs-metrics.service';

const READ_MODEL_PREFIX = 'cqrs:readmodel:';
const DEFAULT_TTL_SECONDS = 60; // Requirement: 60 seconds TTL

@Injectable()
export class ReadModelService {
  private readonly logger = new Logger(ReadModelService.name);
  private readonly inMemoryStore = new Map<string, { value: any; expiresAt: number }>();

  constructor(
    @Optional() private readonly redisService?: RedisService,
    private readonly metrics?: CqrsMetricsService,
  ) {}

  /**
   * Fetch a read model by key with 60-second TTL caching.
   */
  async get<T>(key: string, queryName = 'GetReadModel'): Promise<T | null> {
    const fullKey = `${READ_MODEL_PREFIX}${key}`;

    if (this.redisService) {
      try {
        const cached = await this.redisService.get(fullKey);
        if (cached) {
          this.metrics?.queryCacheHitsTotal.inc({ query: queryName });
          return JSON.parse(cached) as T;
        }
      } catch (err: any) {
        this.logger.warn(`Redis read model error: ${err.message}`);
      }
    }

    // Fallback in-memory cache check
    const local = this.inMemoryStore.get(fullKey);
    if (local && local.expiresAt > Date.now()) {
      this.metrics?.queryCacheHitsTotal.inc({ query: queryName });
      return local.value as T;
    }

    this.metrics?.queryCacheMissesTotal.inc({ query: queryName });
    return null;
  }

  /**
   * Set a read model with 60s TTL.
   */
  async set<T>(key: string, value: T, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<void> {
    const fullKey = `${READ_MODEL_PREFIX}${key}`;
    const serialized = JSON.stringify(value);

    if (this.redisService) {
      try {
        await this.redisService.set(fullKey, serialized, ttlSeconds);
      } catch (err: any) {
        this.logger.warn(`Redis read model set error: ${err.message}`);
      }
    }

    this.inMemoryStore.set(fullKey, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Invalidate a specific read model key.
   */
  async invalidate(key: string): Promise<void> {
    const fullKey = `${READ_MODEL_PREFIX}${key}`;

    if (this.redisService) {
      try {
        await this.redisService.del(fullKey);
      } catch (err: any) {
        this.logger.warn(`Redis read model del error: ${err.message}`);
      }
    }

    this.inMemoryStore.delete(fullKey);
  }

  /**
   * Invalidate multiple read model keys or pattern.
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const fullKeyPattern = `${READ_MODEL_PREFIX}${pattern}`;

    for (const k of this.inMemoryStore.keys()) {
      if (k.includes(pattern)) {
        this.inMemoryStore.delete(k);
      }
    }

    if (this.redisService) {
      try {
        await this.redisService.delByPattern(`${fullKeyPattern}*`);
      } catch (err: any) {
        this.logger.warn(`Redis invalidate pattern error: ${err.message}`);
      }
    }
  }

  /** Health probe check helper */
  isReady(): boolean {
    return true;
  }
}
