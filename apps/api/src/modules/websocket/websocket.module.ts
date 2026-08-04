import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppGateway } from './app.gateway';
import { PresenceService } from './services/presence.service';
import { RoomService } from './services/room.service';
import { ConnectionManager } from './services/connection-manager.service';
import { RealtimePublisher } from './services/realtime-publisher.service';
import { WsEventBridgeSubscriber } from './services/ws-event-bridge.subscriber';
import { WebsocketMetricsService } from './services/websocket-metrics.service';

@Module({
  imports: [
    JwtModule.register({}),
  ],
  providers: [
    AppGateway,
    PresenceService,
    RoomService,
    ConnectionManager,
    RealtimePublisher,
    WsEventBridgeSubscriber,
    WebsocketMetricsService,
  ],
  exports: [RealtimePublisher, PresenceService, ConnectionManager, WebsocketMetricsService],
})
export class WebsocketModule {}
