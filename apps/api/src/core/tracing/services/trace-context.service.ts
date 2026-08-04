import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface TraceContextStore {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  requestId?: string;
  correlationId?: string;
  userId?: string;
  sampled: boolean;
  attributes: Record<string, any>;
}

@Injectable()
export class TraceContextService {
  private static readonly als = new AsyncLocalStorage<TraceContextStore>();

  /**
   * Run a function with the given trace context in AsyncLocalStorage.
   */
  run<T>(store: TraceContextStore, fn: () => T): T {
    return TraceContextService.als.run(store, fn);
  }

  /**
   * Get the current trace context store from ALS.
   */
  getStore(): TraceContextStore | undefined {
    return TraceContextService.als.getStore();
  }

  /**
   * Get current traceId or generate a fallback.
   */
  getTraceId(): string | undefined {
    return this.getStore()?.traceId;
  }

  /**
   * Get current spanId.
   */
  getSpanId(): string | undefined {
    return this.getStore()?.spanId;
  }

  /**
   * Get current requestId.
   */
  getRequestId(): string | undefined {
    return this.getStore()?.requestId;
  }

  /**
   * Get current correlationId.
   */
  getCorrelationId(): string | undefined {
    return this.getStore()?.correlationId;
  }

  /**
   * Update or add attributes to the active trace context.
   */
  setAttribute(key: string, value: any): void {
    const store = this.getStore();
    if (store) {
      store.attributes[key] = value;
    }
  }

  /**
   * Set user ID in current trace context.
   */
  setUserId(userId: string): void {
    const store = this.getStore();
    if (store) {
      store.userId = userId;
      store.attributes['user.id'] = userId;
    }
  }
}
