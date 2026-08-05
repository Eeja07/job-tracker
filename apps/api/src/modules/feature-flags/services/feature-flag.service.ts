import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { FeatureFlag } from '@prisma/client';
import { FeatureFlagRepository } from '../../../repositories/feature-flag/feature-flag.repository';
import { RedisService } from '../../redis/redis.service';
import { MetricsService } from '../../../core/metrics/metrics.service';
import { CreateFeatureFlagDto } from '../dto/create-feature-flag.dto';
import { UpdateFeatureFlagDto } from '../dto/update-feature-flag.dto';

const CACHE_TTL_SECONDS = 60;
const CACHE_KEY_PREFIX = 'feature-flags:';

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);

  constructor(
    private readonly featureFlagRepository: FeatureFlagRepository,
    @Optional() private readonly redisService?: RedisService,
    @Optional() private readonly metricsService?: MetricsService,
  ) {}

  /**
   * Helper to format Redis cache key for a given feature flag
   */
  private getCacheKey(key: string): string {
    return `${CACHE_KEY_PREFIX}${key}`;
  }

  /**
   * Hashes key and userId to compute a deterministic bucket (0 - 99) for rollout percentage
   */
  private calculateUserBucket(key: string, userId: string): number {
    let hash = 0;
    const str = `${key}:${userId}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash) % 100;
  }

  /**
   * Retrieves a feature flag by key, utilizing Redis cache with a 60-second TTL.
   */
  async get(key: string): Promise<FeatureFlag | null> {
    const cacheKey = this.getCacheKey(key);

    if (this.redisService) {
      try {
        const cachedStr = await this.redisService.get(cacheKey);
        if (cachedStr) {
          this.metricsService?.featureFlagCacheHitsTotal.inc({ flag: key });
          const parsed = JSON.parse(cachedStr);
          return {
            ...parsed,
            createdAt: new Date(parsed.createdAt),
            updatedAt: new Date(parsed.updatedAt),
          } as FeatureFlag;
        }
      } catch (err) {
        this.logger.warn(
          `Failed to read feature flag from Redis cache: ${err}`,
        );
      }
    }

    this.metricsService?.featureFlagCacheMissesTotal.inc({ flag: key });
    const flag = await this.featureFlagRepository.findByKey(key);

    if (flag && this.redisService) {
      try {
        await this.redisService.set(
          cacheKey,
          JSON.stringify(flag),
          CACHE_TTL_SECONDS,
        );
      } catch (err) {
        this.logger.warn(`Failed to write feature flag to Redis cache: ${err}`);
      }
    }

    return flag;
  }

  /**
   * Determines whether a feature flag is active for a given key and optional userId.
   */
  async isEnabled(key: string, userId?: string): Promise<boolean> {
    const flag = await this.get(key);

    if (!flag || !flag.enabled) {
      this.metricsService?.featureFlagMissesTotal.inc({ flag: key });
      return false;
    }

    if (flag.rolloutPercentage >= 100) {
      this.metricsService?.featureFlagHitsTotal.inc({ flag: key });
      return true;
    }

    if (flag.rolloutPercentage <= 0) {
      this.metricsService?.featureFlagMissesTotal.inc({ flag: key });
      return false;
    }

    if (userId) {
      const userBucket = this.calculateUserBucket(key, userId);
      if (userBucket < flag.rolloutPercentage) {
        this.metricsService?.featureFlagHitsTotal.inc({ flag: key });
        return true;
      }
    }

    this.metricsService?.featureFlagMissesTotal.inc({ flag: key });
    return false;
  }

  /**
   * Refreshes all feature flags from DB into Redis cache.
   */
  async refresh(): Promise<void> {
    const flags = await this.featureFlagRepository.findAll();
    if (this.redisService) {
      for (const flag of flags) {
        const cacheKey = this.getCacheKey(flag.key);
        try {
          await this.redisService.set(
            cacheKey,
            JSON.stringify(flag),
            CACHE_TTL_SECONDS,
          );
        } catch (err) {
          this.logger.warn(
            `Failed to refresh feature flag ${flag.key} in cache: ${err}`,
          );
        }
      }
    }
  }

  /**
   * Sets enabled state for a flag and invalidates cache.
   */
  async setEnabled(key: string, enabled: boolean): Promise<FeatureFlag> {
    const existing = await this.featureFlagRepository.findByKey(key);
    if (!existing) {
      throw new NotFoundException(`Feature flag with key '${key}' not found.`);
    }

    const updated = await this.featureFlagRepository.update(key, { enabled });
    await this.invalidateCache(key, updated);
    return updated;
  }

  /**
   * Sets rollout percentage for a flag and invalidates cache.
   */
  async setRollout(
    key: string,
    rolloutPercentage: number,
  ): Promise<FeatureFlag> {
    const existing = await this.featureFlagRepository.findByKey(key);
    if (!existing) {
      throw new NotFoundException(`Feature flag with key '${key}' not found.`);
    }

    const updated = await this.featureFlagRepository.update(key, {
      rolloutPercentage,
    });
    await this.invalidateCache(key, updated);
    return updated;
  }

  /**
   * Returns all feature flags.
   */
  async getAll(): Promise<FeatureFlag[]> {
    return this.featureFlagRepository.findAll();
  }

  /**
   * Creates a new feature flag and caches it.
   */
  async create(dto: CreateFeatureFlagDto): Promise<FeatureFlag> {
    const created = await this.featureFlagRepository.upsert(dto.key, dto);
    await this.invalidateCache(dto.key, created);
    return created;
  }

  /**
   * Updates feature flag description, enabled status, or rollout percentage.
   */
  async update(key: string, dto: UpdateFeatureFlagDto): Promise<FeatureFlag> {
    const existing = await this.featureFlagRepository.findByKey(key);
    if (!existing) {
      throw new NotFoundException(`Feature flag with key '${key}' not found.`);
    }

    const updated = await this.featureFlagRepository.update(key, dto);
    await this.invalidateCache(key, updated);
    return updated;
  }

  /**
   * Deletes a feature flag and removes it from cache.
   */
  async delete(key: string): Promise<void> {
    const existing = await this.featureFlagRepository.findByKey(key);
    if (!existing) {
      throw new NotFoundException(`Feature flag with key '${key}' not found.`);
    }

    await this.featureFlagRepository.delete(key);
    if (this.redisService) {
      try {
        await this.redisService.del(this.getCacheKey(key));
      } catch (err) {
        this.logger.warn(
          `Failed to delete cache for feature flag ${key}: ${err}`,
        );
      }
    }
  }

  /**
   * Helper to invalidate and optionally update Redis cache for a flag key
   */
  private async invalidateCache(
    key: string,
    flag?: FeatureFlag,
  ): Promise<void> {
    if (this.redisService) {
      const cacheKey = this.getCacheKey(key);
      try {
        await this.redisService.del(cacheKey);
        if (flag) {
          await this.redisService.set(
            cacheKey,
            JSON.stringify(flag),
            CACHE_TTL_SECONDS,
          );
        }
      } catch (err) {
        this.logger.warn(`Failed to invalidate cache for flag ${key}: ${err}`);
      }
    }
  }
}
