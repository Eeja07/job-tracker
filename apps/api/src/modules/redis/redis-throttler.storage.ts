import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { RedisService } from './redis.service';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);

  constructor(private readonly redisService: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redisKey = `throttler:${throttlerName}:${key}`;
    const ttlSeconds = Math.max(1, Math.ceil(ttl / 1000));

    try {
      const totalHits = await this.redisService.increment(redisKey);
      if (totalHits === 1) {
        await this.redisService.expire(redisKey, ttlSeconds);
      }

      const timeToLive = await this.redisService.ttl(redisKey);

      return {
        totalHits,
        timeToExpire: timeToLive > 0 ? timeToLive : ttlSeconds,
        isBlocked: totalHits > limit,
        timeToBlockExpire: 0,
      };
    } catch (err: any) {
      this.logger.warn(`Redis rate limiting fallback due to error: ${err.message}`);
      return {
        totalHits: 1,
        timeToExpire: ttlSeconds,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }
}
