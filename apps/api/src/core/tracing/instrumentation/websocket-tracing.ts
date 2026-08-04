import { Injectable } from '@nestjs/common';
import { TracingService } from '../services/tracing.service';
import { SPAN_NAMES } from '../constants/tracing.constants';

@Injectable()
export class WebSocketTracing {
  constructor(private readonly tracingService: TracingService) {}

  /**
   * Wrap WebSocket connection or event handling in a trace span.
   */
  async traceConnection<T>(socketId: string, userId: string, fn: () => Promise<T>): Promise<T> {
    return this.tracingService.trace(
      SPAN_NAMES.WEBSOCKET_CONNECTION,
      async (span) => {
        span.attributes['rpc.system'] = 'socket.io';
        span.attributes['rpc.socket_id'] = socketId;
        span.attributes['rpc.user_id'] = userId;
        return await fn();
      },
    );
  }

  async traceBroadcast<T>(room: string, event: string, fn: () => Promise<T>): Promise<T> {
    return this.tracingService.trace(
      SPAN_NAMES.WEBSOCKET_BROADCAST,
      async (span) => {
        span.attributes['rpc.system'] = 'socket.io';
        span.attributes['rpc.destination'] = room;
        span.attributes['rpc.event'] = event;
        return await fn();
      },
    );
  }
}
