import { Test, TestingModule } from '@nestjs/testing';
import { AppGateway } from './app.gateway';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PresenceService } from './services/presence.service';
import { RoomService } from './services/room.service';
import { ConnectionManager } from './services/connection-manager.service';
import { RealtimePublisher } from './services/realtime-publisher.service';
import { WsEventBridgeSubscriber } from './services/ws-event-bridge.subscriber';
import { WebsocketMetricsService } from './services/websocket-metrics.service';
import { EventSubscriberService } from '../event-bus/services/event-subscriber.service';
import { AuthenticatedSocket } from './interfaces/authenticated-socket.interface';
import { WsClientEvent, WsServerEvent } from './constants/ws-events.constants';

function makeSocket(userId = 'user-1', roles: string[] = []): jest.Mocked<AuthenticatedSocket> {
  return {
    id: 'socket-test-1',
    user: { sub: userId, email: `${userId}@test.com`, roles },
    joinedRooms: new Set<string>(),
    lastHeartbeat: Date.now(),
    connectionTime: Date.now(),
    correlationId: 'corr-test',
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    disconnect: jest.fn(),
  } as unknown as jest.Mocked<AuthenticatedSocket>;
}

describe('AppGateway', () => {
  let gateway: AppGateway;
  let connectionManager: jest.Mocked<ConnectionManager>;
  let presenceService: jest.Mocked<PresenceService>;
  let roomService: jest.Mocked<RoomService>;
  let wsMetrics: jest.Mocked<WebsocketMetricsService>;

  beforeEach(async () => {
    const mockJwt = {
      verify: jest.fn().mockReturnValue({ sub: 'user-1', email: 'user-1@test.com' }),
    };
    const mockConfig = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'WS_MAX_CONNECTIONS_PER_USER') return 5;
        return 'dev-access-secret-key-12345';
      }),
    };
    const mockPresence = {
      setServer: jest.fn(),
      registerConnection: jest.fn().mockResolvedValue(undefined),
      removeConnection: jest.fn().mockResolvedValue(undefined),
      updateHeartbeat: jest.fn().mockResolvedValue(undefined),
    };
    const mockRoomService = {
      autoJoinUserRoom: jest.fn().mockResolvedValue(undefined),
      cleanupRooms: jest.fn().mockResolvedValue(undefined),
      joinRoom: jest.fn().mockResolvedValue({ success: true }),
      leaveRoom: jest.fn().mockResolvedValue(undefined),
    };
    const mockConnectionManager = {
      register: jest.fn(),
      unregister: jest.fn().mockReturnValue({ userId: 'user-1', connectedAt: Date.now() }),
      touchActivity: jest.fn(),
      getConnectionCount: jest.fn().mockReturnValue(1),
      getStaleSocketIds: jest.fn().mockReturnValue([]),
      getUserSocketIds: jest.fn().mockReturnValue([]),
      clear: jest.fn(),
    };
    const mockPublisher = {
      setServer: jest.fn(),
      emitToRoom: jest.fn(),
    };
    const mockBridge = {
      name: 'WsEventBridgeSubscriber',
      subscribedEvents: [],
      handle: jest.fn(),
    };
    const mockMetrics = {
      connectionsTotal: { inc: jest.fn() },
      connectionsActive: { set: jest.fn() },
      disconnectsTotal: { inc: jest.fn() },
      authFailuresTotal: { inc: jest.fn() },
      messagesSentTotal: { inc: jest.fn() },
      messagesReceivedTotal: { inc: jest.fn() },
      latencySeconds: { observe: jest.fn() },
    };
    const mockEventSubscriberService = {
      registerSubscriber: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppGateway,
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: PresenceService, useValue: mockPresence },
        { provide: RoomService, useValue: mockRoomService },
        { provide: ConnectionManager, useValue: mockConnectionManager },
        { provide: RealtimePublisher, useValue: mockPublisher },
        { provide: WsEventBridgeSubscriber, useValue: mockBridge },
        { provide: WebsocketMetricsService, useValue: mockMetrics },
        { provide: EventSubscriberService, useValue: mockEventSubscriberService },
      ],
    }).compile();

    gateway = module.get<AppGateway>(AppGateway);
    connectionManager = module.get(ConnectionManager);
    presenceService = module.get(PresenceService);
    roomService = module.get(RoomService);
    wsMetrics = module.get(WebsocketMetricsService);
  });

  it('should register the WsEventBridgeSubscriber on module init', () => {
    const mockEventSub = { registerSubscriber: jest.fn() } as any;
    (gateway as any).eventSubscriberService = mockEventSub;
    gateway.onModuleInit();
    expect(mockEventSub.registerSubscriber).toHaveBeenCalled();
  });

  it('should register connection and emit connected event on handleConnection', async () => {
    const socket = makeSocket();
    await gateway.handleConnection(socket);
    expect(connectionManager.register).toHaveBeenCalledWith(socket);
    expect(presenceService.registerConnection).toHaveBeenCalledWith('user-1', socket.id);
    expect(roomService.autoJoinUserRoom).toHaveBeenCalledWith(socket);
    expect(socket.emit).toHaveBeenCalledWith(WsServerEvent.CONNECTED, expect.objectContaining({ userId: 'user-1' }));
    expect(wsMetrics.connectionsTotal.inc).toHaveBeenCalled();
  });

  it('should cleanup connection on handleDisconnect', async () => {
    const socket = makeSocket();
    await gateway.handleDisconnect(socket);
    expect(connectionManager.unregister).toHaveBeenCalledWith(socket.id);
    expect(presenceService.removeConnection).toHaveBeenCalledWith('user-1', socket.id);
    expect(wsMetrics.disconnectsTotal.inc).toHaveBeenCalled();
  });

  it('handleHeartbeat should update heartbeat and emit ack', async () => {
    const socket = makeSocket();
    await gateway.handleHeartbeat(socket);
    expect(presenceService.updateHeartbeat).toHaveBeenCalledWith('user-1');
    expect(wsMetrics.messagesReceivedTotal.inc).toHaveBeenCalledWith({ event: WsClientEvent.HEARTBEAT });
    expect(socket.emit).toHaveBeenCalledWith(WsServerEvent.HEARTBEAT_ACK, expect.anything());
  });

  it('handlePing should emit pong with server timestamp', () => {
    const socket = makeSocket();
    gateway.handlePing(socket, { t: Date.now() - 20 });
    expect(socket.emit).toHaveBeenCalledWith(WsServerEvent.PONG, expect.objectContaining({ serverTime: expect.any(String) }));
  });

  it('handleJoinRoom should delegate to RoomService', async () => {
    const socket = makeSocket();
    await gateway.handleJoinRoom(socket, { room: 'application:app-1' });
    expect(roomService.joinRoom).toHaveBeenCalled();
  });

  it('should reject connection when max user sockets limit is exceeded', async () => {
    (connectionManager.getUserSocketIds as jest.Mock).mockReturnValue(['sock-1', 'sock-2', 'sock-3', 'sock-4', 'sock-5']);
    const socket = makeSocket();
    await gateway.handleConnection(socket);
    expect(socket.emit).toHaveBeenCalledWith(WsServerEvent.ERROR, expect.objectContaining({ message: expect.stringContaining('Maximum connection limit') }));
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('should cleanly disconnect active sockets and stop server onModuleDestroy', async () => {
    const mockSocket = makeSocket();
    gateway.server = {
      sockets: {
        fetchSockets: jest.fn().mockResolvedValue([mockSocket]),
      },
      close: jest.fn(),
    } as any;

    await gateway.onModuleDestroy();

    expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    expect(gateway.server.close).toHaveBeenCalled();
  });

  it('should reject authentication if token is missing or invalid', async () => {
    const mockSocket = {
      id: 's-unauth',
      handshake: { auth: {}, headers: {} },
    } as any;
    const nextFn = jest.fn();

    await (gateway as any).authenticateSocket(mockSocket, nextFn);
    expect(nextFn).toHaveBeenCalledWith(expect.objectContaining({ message: 'Authentication required' }));
  });
});
