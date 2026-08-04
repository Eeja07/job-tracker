import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { AuthenticatedSocket } from '../interfaces/authenticated-socket.interface';

interface ConnectionRecord {
  socketId: string;
  userId: string;
  connectedAt: number;
  lastActivity: number;
}

@Injectable()
export class ConnectionManager {
  private readonly logger = new Logger(ConnectionManager.name);
  private readonly connections = new Map<string, ConnectionRecord>(); // socketId → record
  private readonly userSockets = new Map<string, Set<string>>(); // userId → Set<socketId>

  /**
   * Register a new socket connection.
   */
  register(socket: AuthenticatedSocket): void {
    const userId = socket.user.sub;
    const socketId = socket.id;
    const now = Date.now();

    this.connections.set(socketId, {
      socketId,
      userId,
      connectedAt: now,
      lastActivity: now,
    });

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);

    this.logger.log(
      JSON.stringify({
        message: 'Socket connection registered',
        socketId,
        userId,
        totalConnections: this.connections.size,
        userTabCount: this.userSockets.get(userId)!.size,
      }),
    );
  }

  /**
   * Unregister a socket on disconnect.
   */
  unregister(socketId: string): ConnectionRecord | undefined {
    const record = this.connections.get(socketId);
    if (!record) return undefined;

    this.connections.delete(socketId);

    const userSocketSet = this.userSockets.get(record.userId);
    if (userSocketSet) {
      userSocketSet.delete(socketId);
      if (userSocketSet.size === 0) {
        this.userSockets.delete(record.userId);
      }
    }

    this.logger.log(
      JSON.stringify({
        message: 'Socket connection unregistered',
        socketId,
        userId: record.userId,
        totalConnections: this.connections.size,
      }),
    );

    return record;
  }

  /**
   * Update last activity timestamp for a socket.
   */
  touchActivity(socketId: string): void {
    const record = this.connections.get(socketId);
    if (record) {
      record.lastActivity = Date.now();
    }
  }

  /**
   * Get all socket IDs for a specific user (multi-tab support).
   */
  getUserSocketIds(userId: string): string[] {
    return Array.from(this.userSockets.get(userId) || []);
  }

  /**
   * Check if a user has any active connections.
   */
  isUserConnected(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return !!sockets && sockets.size > 0;
  }

  /**
   * Total active connection count.
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get all user IDs with active connections.
   */
  getOnlineUserIds(): string[] {
    return Array.from(this.userSockets.keys());
  }

  /**
   * Force-disconnect stale sessions (no activity for given timeout).
   */
  getStaleSocketIds(timeoutMs: number): string[] {
    const cutoff = Date.now() - timeoutMs;
    const stale: string[] = [];
    for (const [socketId, record] of this.connections) {
      if (record.lastActivity < cutoff) {
        stale.push(socketId);
      }
    }
    return stale;
  }
}
