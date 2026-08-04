import { Injectable, Logger, Optional } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry } from 'prom-client';

@Injectable()
export class WebsocketMetricsService {
  private readonly logger = new Logger(WebsocketMetricsService.name);

  public readonly connectionsActive: Gauge<string>;
  public readonly connectionsTotal: Counter<string>;
  public readonly disconnectsTotal: Counter<string>;
  public readonly authFailuresTotal: Counter<string>;
  public readonly messagesSentTotal: Counter<string>;
  public readonly messagesReceivedTotal: Counter<string>;
  public readonly latencySeconds: Histogram<string>;

  constructor(@Optional() private readonly registry?: Registry) {
    // Use a local sub-registry so metrics don't collide with the global one
    const reg = this.registry || new Registry();

    this.connectionsActive = new Gauge({
      name: 'websocket_connections_active',
      help: 'Current number of active WebSocket connections',
      registers: [reg],
    });

    this.connectionsTotal = new Counter({
      name: 'websocket_connections_total',
      help: 'Total WebSocket connections established',
      registers: [reg],
    });

    this.disconnectsTotal = new Counter({
      name: 'websocket_disconnects_total',
      help: 'Total WebSocket disconnections',
      labelNames: ['reason'],
      registers: [reg],
    });

    this.authFailuresTotal = new Counter({
      name: 'websocket_auth_failures_total',
      help: 'Total WebSocket JWT authentication failures',
      registers: [reg],
    });

    this.messagesSentTotal = new Counter({
      name: 'websocket_messages_sent_total',
      help: 'Total messages sent by the server to clients',
      labelNames: ['event'],
      registers: [reg],
    });

    this.messagesReceivedTotal = new Counter({
      name: 'websocket_messages_received_total',
      help: 'Total messages received from clients',
      labelNames: ['event'],
      registers: [reg],
    });

    this.latencySeconds = new Histogram({
      name: 'websocket_latency_seconds',
      help: 'WebSocket ping/pong round-trip latency in seconds',
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1],
      registers: [reg],
    });
  }
}
