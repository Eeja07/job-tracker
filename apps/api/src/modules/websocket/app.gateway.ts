import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import {
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  AuthenticatedSocket,
  AuthenticatedUser,
} from './interfaces/authenticated-socket.interface';
import { PresenceService } from './services/presence.service';
import { RoomService } from './services/room.service';
import { ConnectionManager } from './services/connection-manager.service';
import { RealtimePublisher } from './services/realtime-publisher.service';
import { WsEventBridgeSubscriber } from './services/ws-event-bridge.subscriber';
import { WebsocketMetricsService } from './services/websocket-metrics.service';
import { EventSubscriberService } from '../event-bus/services/event-subscriber.service';
import { WsClientEvent, WsServerEvent } from './constants/ws-events.constants';
import {
  HEARTBEAT_TIMEOUT_MS,
  userRoom,
} from './constants/ws-rooms.constants';

const MAX_PAYLOAD_SIZE = 64 * 1024; // 64 KB

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      // Allow all in development; restrict by CORS_ORIGIN in production
      cb(null, true);
    },
    credentials: true,
  },
  maxHttpBufferSize: MAX_PAYLOAD_SIZE,
  transports: ['websocket', 'polling'],
  namespace: '/ws',
})
export class AppGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AppGateway.name);
  private heartbeatTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly presenceService: PresenceService,
    private readonly roomService: RoomService,
    private readonly connectionManager: ConnectionManager,
    private readonly realtimePublisher: RealtimePublisher,
    private readonly wsBridge: WsEventBridgeSubscriber,
    private readonly wsMetrics: WebsocketMetricsService,
    @Optional() private readonly eventSubscriberService?: EventSubscriberService,
  ) {}

  onModuleInit(): void {
    // Register the WebSocket bridge subscriber into the Event Bus
    if (this.eventSubscriberService) {
      this.eventSubscriberService.registerSubscriber(this.wsBridge);
      this.logger.log('WsEventBridgeSubscriber registered with EventBus');
    }
  }

  afterInit(server: Server): void {
    this.realtimePublisher.setServer(server);
    this.presenceService.setServer(server);

    // JWT handshake middleware – runs before handleConnection
    server.use((socket: Socket, next) => {
      this.authenticateSocket(socket as AuthenticatedSocket, next);
    });

    // Start stale connection cleanup interval
    this.heartbeatTimer = setInterval(() => {
      this.evictStaleConnections();
    }, HEARTBEAT_TIMEOUT_MS);

    this.logger.log('AppGateway initialized');
  }

  onModuleDestroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
  }

  async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    try {
      const userId = socket.user.sub;
      const correlationId = randomUUID();
      socket.correlationId = correlationId;
      socket.joinedRooms = new Set();
      socket.lastHeartbeat = Date.now();
      socket.connectionTime = Date.now();

      // Register in memory manager
      this.connectionManager.register(socket);

      // Register Redis presence
      await this.presenceService.registerConnection(userId, socket.id);

      // Auto-join user's personal room
      await this.roomService.autoJoinUserRoom(socket);

      // Update metrics
      this.wsMetrics.connectionsTotal.inc();
      this.wsMetrics.connectionsActive.set(this.connectionManager.getConnectionCount());

      // Confirm connection to client
      socket.emit(WsServerEvent.CONNECTED, {
        socketId: socket.id,
        userId,
        correlationId,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(
        JSON.stringify({
          message: 'Client connected',
          socketId: socket.id,
          userId,
          correlationId,
        }),
      );
    } catch (err: any) {
      this.logger.error(`handleConnection error: ${err.message}`);
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: AuthenticatedSocket): Promise<void> {
    const userId = socket.user?.sub;
    const socketId = socket.id;

    // Clean up room memberships
    if (socket.joinedRooms) {
      await this.roomService.cleanupRooms(socket);
    }

    // Remove from in-memory tracker
    const record = this.connectionManager.unregister(socketId);

    // Clean up Redis presence
    if (userId) {
      await this.presenceService.removeConnection(userId, socketId);
    }

    // Update metrics
    this.wsMetrics.disconnectsTotal.inc({ reason: 'client_disconnect' });
    this.wsMetrics.connectionsActive.set(this.connectionManager.getConnectionCount());

    this.logger.log(
      JSON.stringify({
        message: 'Client disconnected',
        socketId,
        userId: userId || 'unknown',
        durationMs: record ? Date.now() - record.connectedAt : -1,
      }),
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // Client event handlers
  // ─────────────────────────────────────────────────────────────────────

  @SubscribeMessage(WsClientEvent.HEARTBEAT)
  async handleHeartbeat(
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const s = socket as AuthenticatedSocket;
    s.lastHeartbeat = Date.now();
    this.connectionManager.touchActivity(s.id);

    await this.presenceService.updateHeartbeat(s.user.sub);
    this.wsMetrics.messagesReceivedTotal.inc({ event: WsClientEvent.HEARTBEAT });

    s.emit(WsServerEvent.HEARTBEAT_ACK, { timestamp: new Date().toISOString() });
  }

  @SubscribeMessage(WsClientEvent.PING)
  handlePing(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { t: number },
  ): void {
    const s = socket as AuthenticatedSocket;
    const clientTs = data?.t ?? 0;
    const latencySeconds = clientTs > 0 ? (Date.now() - clientTs) / 1000 : 0;

    this.wsMetrics.messagesReceivedTotal.inc({ event: WsClientEvent.PING });
    if (latencySeconds > 0 && latencySeconds < 60) {
      this.wsMetrics.latencySeconds.observe(latencySeconds);
    }

    s.emit(WsServerEvent.PONG, { t: Date.now(), serverTime: new Date().toISOString() });
  }

  @SubscribeMessage(WsClientEvent.JOIN_ROOM)
  async handleJoinRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { room: string },
  ): Promise<void> {
    const s = socket as AuthenticatedSocket;
    this.wsMetrics.messagesReceivedTotal.inc({ event: WsClientEvent.JOIN_ROOM });

    if (!data?.room || typeof data.room !== 'string') {
      s.emit(WsServerEvent.ERROR, { message: 'Invalid room name' });
      return;
    }

    const result = await this.roomService.joinRoom(this.server, s, data.room);
    if (!result.success) {
      s.emit(WsServerEvent.ERROR, { message: result.error });
    }
  }

  @SubscribeMessage(WsClientEvent.LEAVE_ROOM)
  async handleLeaveRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { room: string },
  ): Promise<void> {
    const s = socket as AuthenticatedSocket;
    this.wsMetrics.messagesReceivedTotal.inc({ event: WsClientEvent.LEAVE_ROOM });

    if (!data?.room || typeof data.room !== 'string') {
      s.emit(WsServerEvent.ERROR, { message: 'Invalid room name' });
      return;
    }

    await this.roomService.leaveRoom(s, data.room);
  }

  @SubscribeMessage(WsClientEvent.SUBSCRIBE_APPLICATION)
  async handleSubscribeApplication(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { applicationId: string },
  ): Promise<void> {
    const s = socket as AuthenticatedSocket;
    this.wsMetrics.messagesReceivedTotal.inc({ event: WsClientEvent.SUBSCRIBE_APPLICATION });

    if (!data?.applicationId) {
      s.emit(WsServerEvent.ERROR, { message: 'applicationId required' });
      return;
    }

    const room = `application:${data.applicationId}`;
    await this.roomService.joinRoom(this.server, s, room);
  }

  @SubscribeMessage(WsClientEvent.SUBSCRIBE_COMPANY)
  async handleSubscribeCompany(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { companyId: string },
  ): Promise<void> {
    const s = socket as AuthenticatedSocket;
    this.wsMetrics.messagesReceivedTotal.inc({ event: WsClientEvent.SUBSCRIBE_COMPANY });

    if (!data?.companyId) {
      s.emit(WsServerEvent.ERROR, { message: 'companyId required' });
      return;
    }

    const room = `company:${data.companyId}`;
    await this.roomService.joinRoom(this.server, s, room);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────

  private authenticateSocket(
    socket: AuthenticatedSocket,
    next: (err?: Error) => void,
  ): void {
    try {
      const token =
        (socket.handshake.auth as any)?.token ||
        (socket.handshake.headers as any)?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.wsMetrics.authFailuresTotal.inc();
        this.logger.warn(
          JSON.stringify({
            message: 'WS auth rejected: no token provided',
            socketId: socket.id,
          }),
        );
        return next(new Error('Authentication required'));
      }

      const secret = this.configService.get<string>('JWT_ACCESS_SECRET') || 'dev-access-secret-key-12345';
      const payload = this.jwtService.verify<AuthenticatedUser>(token, { secret });

      socket.user = payload;

      this.logger.log(
        JSON.stringify({
          message: 'WS socket authenticated',
          socketId: socket.id,
          userId: payload.sub,
        }),
      );

      return next();
    } catch (err: any) {
      this.wsMetrics.authFailuresTotal.inc();
      this.logger.warn(
        JSON.stringify({
          message: 'WS auth rejected: invalid or expired token',
          socketId: socket.id,
          error: err.message,
        }),
      );
      return next(new Error('Invalid or expired token'));
    }
  }

  private evictStaleConnections(): void {
    const staleIds = this.connectionManager.getStaleSocketIds(HEARTBEAT_TIMEOUT_MS);
    for (const socketId of staleIds) {
      const s = this.server.sockets.sockets.get(socketId) as AuthenticatedSocket | undefined;
      if (s) {
        this.logger.warn(
          JSON.stringify({
            message: 'Evicting stale WebSocket connection',
            socketId,
            userId: s.user?.sub,
          }),
        );
        s.disconnect(true);
        this.wsMetrics.disconnectsTotal.inc({ reason: 'stale_timeout' });
      }
    }
  }
}
