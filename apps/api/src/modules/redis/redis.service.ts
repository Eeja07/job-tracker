import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import { randomUUID } from 'crypto';

export interface RedisMetrics {
  status: string;
  memoryUsageBytes: number;
  hits: number;
  misses: number;
  hitRatio: number;
}

const RELEASE_LOCK_LUA_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`.trim();

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;
  private subClient?: Redis;
  private hits = 0;
  private misses = 0;

  // Single listener event dispatcher map for Redis Pub/Sub subscribers
  private readonly channelHandlers = new Map<
    string,
    Set<(message: string) => void>
  >();
  private isSubListenerRegistered = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const host = this.configService.getOrThrow<string>('REDIS_HOST');
    const port = this.configService.getOrThrow<number>('REDIS_PORT');
    const password =
      this.configService.get<string>('REDIS_PASSWORD') || undefined;
    const db = this.configService.get<number>('REDIS_DB') || 0;
    const useTls = this.configService.get<boolean>('REDIS_TLS') || false;

    const redisOptions: RedisOptions = {
      host,
      port,
      password,
      db,
      tls: useTls ? {} : undefined,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      retryStrategy: (times: number) => {
        if (times > 3) {
          return null; // Stop retrying after 3 attempts
        }
        return Math.min(times * 200, 1000);
      },
    };

    this.client = new Redis(redisOptions);
    this.subClient = new Redis({ ...redisOptions, lazyConnect: false });

    this.client.on('error', (err) => {
      this.logger.warn(`Redis connection error: ${err.message}`);
    });

    this.subClient.on('error', (err) => {
      this.logger.warn(`Redis subClient error: ${err.message}`);
    });

    // Await both clients fully ready before returning.
    // NestJS will not call onModuleInit on other modules until this Promise
    // resolves, so subscribe() calls from sibling modules are guaranteed to
    // find a ready subClient.
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        this.client.once('ready', () => {
          this.logger.log(`Connected to Redis at ${host}:${port} (DB ${db})`);
          resolve();
        });
        this.client.once('error', reject);
      }),
      new Promise<void>((resolve, reject) => {
        this.subClient!.once('ready', resolve);
        this.subClient!.once('error', reject);
      }),
    ]);
  }

  async onModuleDestroy() {
    try {
      this.channelHandlers.clear();
      this.isSubListenerRegistered = false;
      if (this.subClient) {
        this.subClient.disconnect();
      }
      if (this.client) {
        this.client.disconnect();
      }
    } catch (err: any) {
      this.logger.warn(`Error closing Redis connection: ${err.message}`);
    }
  }

  getClient(): Redis {
    return this.client;
  }

  isReady(): boolean {
    return this.client && this.client.status === 'ready';
  }

  async ping(): Promise<string> {
    try {
      return await this.client.ping();
    } catch (err: any) {
      this.logger.warn(`Redis PING failed: ${err.message}`);
      throw err;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      const val = await this.client.get(key);
      if (val !== null) {
        this.hits++;
      } else {
        this.misses++;
      }
      return val;
    } catch (err: any) {
      this.logger.warn(`Redis get error for key [${key}]: ${err.message}`);
      this.misses++;
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
    } catch (err: any) {
      this.logger.warn(`Redis set error for key [${key}]: ${err.message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (err: any) {
      this.logger.warn(`Redis del error for key [${key}]: ${err.message}`);
    }
  }

  /**
   * Delete keys by pattern using non-blocking SCAN iteration instead of blocking KEYS command.
   */
  async delByPattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const res = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        if (!res || !Array.isArray(res)) {
          break;
        }
        const [nextCursor, keys] = res;
        cursor = nextCursor || '0';
        if (keys && keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err: any) {
      this.logger.warn(
        `Redis delByPattern error for pattern [${pattern}]: ${err.message}`,
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const count = await this.client.exists(key);
      return count > 0;
    } catch (err: any) {
      this.logger.warn(`Redis exists error for key [${key}]: ${err.message}`);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (err: any) {
      this.logger.warn(`Redis ttl error for key [${key}]: ${err.message}`);
      return -2;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const res = await this.client.expire(key, ttlSeconds);
      return res === 1;
    } catch (err: any) {
      this.logger.warn(`Redis expire error for key [${key}]: ${err.message}`);
      return false;
    }
  }

  async increment(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (err: any) {
      this.logger.warn(
        `Redis increment error for key [${key}]: ${err.message}`,
      );
      return 0;
    }
  }

  async decrement(key: string): Promise<number> {
    try {
      return await this.client.decr(key);
    } catch (err: any) {
      this.logger.warn(
        `Redis decrement error for key [${key}]: ${err.message}`,
      );
      return 0;
    }
  }

  async publish(channel: string, message: string): Promise<number> {
    try {
      return await this.client.publish(channel, message);
    } catch (err: any) {
      this.logger.warn(
        `Redis publish error for channel [${channel}]: ${err.message}`,
      );
      return 0;
    }
  }

  /**
   * Subscribe to a Redis channel using a single global event listener and internal Map dispatcher
   * to eliminate EventEmitter listener leaks.
   */
  async subscribe(
    channel: string,
    handler: (message: string) => void,
  ): Promise<void> {
    try {
      // Wait for subClient to be initialized if it is not ready yet.
      // EventSubscriberService.onModuleInit() can race with RedisService.onModuleInit()
      // since NestJS does not guarantee initialization order across modules.
      if (!this.subClient) {
        const maxWaitMs = 5000;
        const intervalMs = 50;
        let waited = 0;
        while (!this.subClient && waited < maxWaitMs) {
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
          waited += intervalMs;
        }
        if (!this.subClient) {
          this.logger.warn(
            `Redis subClient not ready after ${maxWaitMs}ms, skipping subscribe for channel [${channel}]`,
          );
          return;
        }
      }

      if (!this.isSubListenerRegistered) {
        this.subClient.on('message', (chan: string, msg: string) => {
          const handlers = this.channelHandlers.get(chan);
          if (handlers) {
            for (const h of handlers) {
              try {
                h(msg);
              } catch (err: any) {
                this.logger.error(
                  `Error in subscriber handler for channel [${chan}]: ${err.message}`,
                );
              }
            }
          }
        });
        this.isSubListenerRegistered = true;
      }

      let handlers = this.channelHandlers.get(channel);
      const isFirstHandler = !handlers || handlers.size === 0;

      if (!handlers) {
        handlers = new Set();
        this.channelHandlers.set(channel, handlers);
      }
      handlers.add(handler);

      if (isFirstHandler) {
        await this.subClient.subscribe(channel);
      }
    } catch (err: any) {
      this.logger.warn(
        `Redis subscribe error for channel [${channel}]: ${err.message}`,
      );
    }
  }

  /**
   * Unsubscribe a handler or clear all handlers for a channel.
   */
  async unsubscribe(
    channel: string,
    handler?: (message: string) => void,
  ): Promise<void> {
    try {
      if (!this.subClient || !this.channelHandlers.has(channel)) {
        return;
      }

      const handlers = this.channelHandlers.get(channel);
      if (handlers && handler) {
        handlers.delete(handler);
      }

      if (!handler || !handlers || handlers.size === 0) {
        this.channelHandlers.delete(channel);
        await this.subClient.unsubscribe(channel);
      }
    } catch (err: any) {
      this.logger.warn(
        `Redis unsubscribe error for channel [${channel}]: ${err.message}`,
      );
    }
  }

  /**
   * Distributed Lock Acquisition with unique random lock token and SET NX EX.
   * Returns the lock token string if acquired, or null if lock acquisition failed.
   */
  async acquireLock(
    key: string,
    ttlSeconds: number,
    token?: string,
  ): Promise<string | null> {
    const lockToken = token || randomUUID();
    try {
      const res = await this.client.set(key, lockToken, 'EX', ttlSeconds, 'NX');
      return res === 'OK' ? lockToken : null;
    } catch (err: any) {
      this.logger.warn(
        `Redis acquireLock error for key [${key}]: ${err.message}`,
      );
      return null;
    }
  }

  /**
   * Distributed Lock Release using atomic Lua compare-and-delete script to ensure process ownership.
   */
  async releaseLock(key: string, lockToken?: string): Promise<boolean> {
    try {
      if (lockToken) {
        const res = await this.client.eval(
          RELEASE_LOCK_LUA_SCRIPT,
          1,
          key,
          lockToken,
        );
        return res === 1 || res === '1';
      }
      const res = await this.client.del(key);
      return res > 0;
    } catch (err: any) {
      this.logger.warn(
        `Redis releaseLock error for key [${key}]: ${err.message}`,
      );
      return false;
    }
  }

  // Metrics / Observability
  async getMetrics(): Promise<RedisMetrics> {
    const totalReqs = this.hits + this.misses;
    const hitRatio =
      totalReqs > 0 ? Number((this.hits / totalReqs).toFixed(4)) : 0;
    let memoryUsageBytes = 0;

    if (this.isReady()) {
      try {
        const info = await this.client.info('memory');
        const match = info.match(/used_memory:(\d+)/);
        if (match) {
          memoryUsageBytes = parseInt(match[1], 10);
        }
      } catch (err: any) {
        this.logger.warn(
          `Failed to retrieve Redis memory metrics: ${err.message}`,
        );
      }
    }

    return {
      status: this.client ? this.client.status : 'disconnected',
      memoryUsageBytes,
      hits: this.hits,
      misses: this.misses,
      hitRatio,
    };
  }
}
