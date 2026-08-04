import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

export interface RedisMetrics {
  status: string;
  memoryUsageBytes: number;
  hits: number;
  misses: number;
  hitRatio: number;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;
  private subClient?: Redis;
  private hits = 0;
  private misses = 0;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.getOrThrow<string>('REDIS_HOST');
    const port = this.configService.getOrThrow<number>('REDIS_PORT');
    const password = this.configService.get<string>('REDIS_PASSWORD') || undefined;
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

    this.client.on('connect', () => {
      this.logger.log(`Connected to Redis at ${host}:${port} (DB ${db})`);
    });

    this.client.on('error', (err) => {
      this.logger.warn(`Redis connection error: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    try {
      if (this.subClient) {
        await this.subClient.quit().catch(() => this.subClient?.disconnect());
      }
      if (this.client) {
        await this.client.quit().catch(() => this.client?.disconnect());
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

  async delByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (err: any) {
      this.logger.warn(`Redis delByPattern error for pattern [${pattern}]: ${err.message}`);
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
      this.logger.warn(`Redis increment error for key [${key}]: ${err.message}`);
      return 0;
    }
  }

  async decrement(key: string): Promise<number> {
    try {
      return await this.client.decr(key);
    } catch (err: any) {
      this.logger.warn(`Redis decrement error for key [${key}]: ${err.message}`);
      return 0;
    }
  }

  async publish(channel: string, message: string): Promise<number> {
    try {
      return await this.client.publish(channel, message);
    } catch (err: any) {
      this.logger.warn(`Redis publish error for channel [${channel}]: ${err.message}`);
      return 0;
    }
  }

  async subscribe(channel: string, handler: (message: string) => void): Promise<void> {
    try {
      if (!this.subClient) {
        this.subClient = this.client.duplicate();
        this.subClient.on('error', (err) => {
          this.logger.warn(`Redis subClient error: ${err.message}`);
        });
      }
      await this.subClient.subscribe(channel);
      this.subClient.on('message', (chan, msg) => {
        if (chan === channel) {
          handler(msg);
        }
      });
    } catch (err: any) {
      this.logger.warn(`Redis subscribe error for channel [${channel}]: ${err.message}`);
    }
  }

  // Lock helper using SET NX EX
  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const res = await this.client.set(key, 'locked', 'EX', ttlSeconds, 'NX');
      return res === 'OK';
    } catch (err: any) {
      this.logger.warn(`Redis acquireLock error for key [${key}]: ${err.message}`);
      return false;
    }
  }

  async releaseLock(key: string): Promise<boolean> {
    try {
      const res = await this.client.del(key);
      return res > 0;
    } catch (err: any) {
      this.logger.warn(`Redis releaseLock error for key [${key}]: ${err.message}`);
      return false;
    }
  }

  // Metrics / Observability
  async getMetrics(): Promise<RedisMetrics> {
    const totalReqs = this.hits + this.misses;
    const hitRatio = totalReqs > 0 ? Number((this.hits / totalReqs).toFixed(4)) : 0;
    let memoryUsageBytes = 0;

    if (this.isReady()) {
      try {
        const info = await this.client.info('memory');
        const match = info.match(/used_memory:(\d+)/);
        if (match) {
          memoryUsageBytes = parseInt(match[1], 10);
        }
      } catch (err: any) {
        this.logger.warn(`Failed to retrieve Redis memory metrics: ${err.message}`);
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
