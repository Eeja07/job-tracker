import { Injectable, Logger, Optional } from '@nestjs/common';
import { Server } from 'socket.io';
import { RedisService } from '../../redis/redis.service';
import { PRESENCE_TTL_SECONDS } from '../constants/ws-rooms.constants';

const PRESENCE_PREFIX = 'ws:presence:';
const CONNECTIONS_PREFIX = 'ws:connections:';

export interface PresenceRecord {
  userId: string;
  socketId: string;
  connectedAt: string;
  lastHeartbeat: string;
  tabCount: number;
}

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private server?: Server;

  constructor(@Optional() private readonly redisService?: RedisService) {}

  setServer(server: Server): void {
    this.server = server;
  }

  /**
   * Register a user connection in Redis presence store.
   * Supports multiple tabs by incrementing tab count.
   */
  async registerConnection(userId: string, socketId: string): Promise<void> {
    if (!this.redisService) return;

    const presenceKey = `${PRESENCE_PREFIX}${userId}`;
    const connectionsKey = `${CONNECTIONS_PREFIX}${userId}`;

    try {
      const existing = await this.redisService.get(presenceKey);
      const now = new Date().toISOString();

      let record: PresenceRecord;
      if (existing) {
        record = JSON.parse(existing);
        record.tabCount = (record.tabCount || 1) + 1;
        record.lastHeartbeat = now;
        record.socketId = socketId; // track most recent socket
      } else {
        record = {
          userId,
          socketId,
          connectedAt: now,
          lastHeartbeat: now,
          tabCount: 1,
        };
      }

      await this.redisService.set(
        presenceKey,
        JSON.stringify(record),
        PRESENCE_TTL_SECONDS * 2,
      );

      // Add socket to user's socket set
      if (this.redisService.getClient) {
        await this.redisService.getClient().sadd(connectionsKey, socketId);
        await this.redisService.expire(
          connectionsKey,
          PRESENCE_TTL_SECONDS * 2,
        );
      }

      this.logger.log(
        JSON.stringify({
          message: 'User presence registered',
          userId,
          socketId,
          tabCount: record.tabCount,
        }),
      );
    } catch (err: any) {
      this.logger.warn(
        `Failed to register presence for user ${userId}: ${err.message}`,
      );
    }
  }

  /**
   * Remove a specific socket connection. Cleans up presence if last tab.
   */
  async removeConnection(userId: string, socketId: string): Promise<void> {
    if (!this.redisService) return;

    const presenceKey = `${PRESENCE_PREFIX}${userId}`;
    const connectionsKey = `${CONNECTIONS_PREFIX}${userId}`;

    try {
      if (this.redisService.getClient) {
        await this.redisService.getClient().srem(connectionsKey, socketId);
        const remainingCount = await this.redisService
          .getClient()
          .scard(connectionsKey);

        if (remainingCount === 0) {
          await this.redisService.del(presenceKey);
          await this.redisService.del(connectionsKey);
          this.logger.log(
            JSON.stringify({
              message: 'User fully disconnected, presence cleared',
              userId,
              socketId,
            }),
          );
        } else {
          const existing = await this.redisService.get(presenceKey);
          if (existing) {
            const record: PresenceRecord = JSON.parse(existing);
            record.tabCount = remainingCount;
            await this.redisService.set(
              presenceKey,
              JSON.stringify(record),
              PRESENCE_TTL_SECONDS * 2,
            );
          }
          this.logger.log(
            JSON.stringify({
              message: 'Socket disconnected, other tabs remain',
              userId,
              socketId,
              remainingTabs: remainingCount,
            }),
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(
        `Failed to remove presence for user ${userId}: ${err.message}`,
      );
    }
  }

  /**
   * Update heartbeat timestamp in Redis for liveness tracking.
   */
  async updateHeartbeat(userId: string): Promise<void> {
    if (!this.redisService) return;

    const presenceKey = `${PRESENCE_PREFIX}${userId}`;
    try {
      const existing = await this.redisService.get(presenceKey);
      if (existing) {
        const record: PresenceRecord = JSON.parse(existing);
        record.lastHeartbeat = new Date().toISOString();
        await this.redisService.set(
          presenceKey,
          JSON.stringify(record),
          PRESENCE_TTL_SECONDS * 2,
        );
      }
    } catch (err: any) {
      this.logger.warn(
        `Failed to update heartbeat for user ${userId}: ${err.message}`,
      );
    }
  }

  /**
   * Check whether a user is currently online.
   */
  async isOnline(userId: string): Promise<boolean> {
    if (!this.redisService) return false;
    return this.redisService.exists(`${PRESENCE_PREFIX}${userId}`);
  }

  /**
   * Get presence record for a user.
   */
  async getPresence(userId: string): Promise<PresenceRecord | null> {
    if (!this.redisService) return null;
    try {
      const raw = await this.redisService.get(`${PRESENCE_PREFIX}${userId}`);
      return raw ? (JSON.parse(raw) as PresenceRecord) : null;
    } catch {
      return null;
    }
  }
}
