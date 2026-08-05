import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { WsServerEvent } from '../constants/ws-events.constants';
import { WebsocketMetricsService } from './websocket-metrics.service';

@Injectable()
export class RealtimePublisher {
  private readonly logger = new Logger(RealtimePublisher.name);
  private server?: Server;

  constructor(private readonly metrics: WebsocketMetricsService) {}

  setServer(server: Server): void {
    this.server = server;
  }

  /**
   * Emit an event to a specific room.
   */
  emitToRoom(
    room: string,
    event: WsServerEvent | string,
    payload: unknown,
  ): void {
    if (!this.server) {
      this.logger.warn('Server not initialized, cannot emit event');
      return;
    }
    this.server.to(room).emit(event, payload);
    this.metrics.messagesSentTotal.inc({ event: String(event) });
    this.logger.log(
      JSON.stringify({ message: 'Emitted to room', room, event }),
    );
  }

  /**
   * Emit an event to a specific socket ID.
   */
  emitToSocket(
    socketId: string,
    event: WsServerEvent | string,
    payload: unknown,
  ): void {
    if (!this.server) return;
    this.server.to(socketId).emit(event, payload);
    this.metrics.messagesSentTotal.inc({ event: String(event) });
  }

  /**
   * Broadcast to all authenticated connections (use sparingly – admin only).
   */
  broadcast(event: WsServerEvent | string, payload: unknown): void {
    if (!this.server) return;
    this.server.emit(event, payload);
    this.metrics.messagesSentTotal.inc({ event: String(event) });
    this.logger.log(JSON.stringify({ message: 'Broadcast event', event }));
  }
}
