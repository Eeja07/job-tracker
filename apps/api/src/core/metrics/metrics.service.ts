import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { RedisService } from '../../modules/redis/redis.service';
import { QueueService } from '../../modules/jobs/services/queue.service';
import { QUEUE_NAMES } from '../../modules/jobs/constants/jobs.constants';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: Registry;

  public readonly httpRequestsTotal: Counter<string>;
  public readonly httpRequestDurationSeconds: Histogram<string>;
  public readonly activeRequests: Gauge<string>;

  public readonly redisConnected: Gauge<string>;
  public readonly redisMemoryUsageBytes: Gauge<string>;
  public readonly redisHitRatio: Gauge<string>;

  public readonly queueWaiting: Gauge<string>;
  public readonly queueActive: Gauge<string>;
  public readonly queueDelayed: Gauge<string>;
  public readonly queueCompleted: Gauge<string>;
  public readonly queueFailed: Gauge<string>;

  public readonly emailsSentTotal: Counter<string>;
  public readonly emailsFailedTotal: Counter<string>;
  public readonly emailDurationSeconds: Histogram<string>;

  public readonly auditLogsTotal: Counter<string>;
  public readonly auditLogsFailedTotal: Counter<string>;
  public readonly auditQueueSize: Gauge<string>;

  constructor(
    @Optional() private readonly redisService?: RedisService,
    @Optional() private readonly queueService?: QueueService,
  ) {
    this.registry = new Registry();

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests processed',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDurationSeconds = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.activeRequests = new Gauge({
      name: 'active_requests',
      help: 'Number of currently active HTTP requests',
      registers: [this.registry],
    });

    this.redisConnected = new Gauge({
      name: 'redis_connected',
      help: 'Redis connection state (1 for ready, 0 for disconnected)',
      registers: [this.registry],
    });

    this.redisMemoryUsageBytes = new Gauge({
      name: 'redis_memory_usage_bytes',
      help: 'Redis memory usage in bytes',
      registers: [this.registry],
    });

    this.redisHitRatio = new Gauge({
      name: 'redis_hit_ratio',
      help: 'Redis cache hit ratio (hits / total requests)',
      registers: [this.registry],
    });

    this.queueWaiting = new Gauge({
      name: 'queue_waiting',
      help: 'Number of waiting jobs in queue',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.queueActive = new Gauge({
      name: 'queue_active',
      help: 'Number of active jobs in queue',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.queueDelayed = new Gauge({
      name: 'queue_delayed',
      help: 'Number of delayed jobs in queue',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.queueCompleted = new Gauge({
      name: 'queue_completed',
      help: 'Number of completed jobs in queue',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.queueFailed = new Gauge({
      name: 'queue_failed',
      help: 'Number of failed jobs in queue',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.emailsSentTotal = new Counter({
      name: 'emails_sent_total',
      help: 'Total number of emails sent successfully',
      labelNames: ['template'],
      registers: [this.registry],
    });

    this.emailsFailedTotal = new Counter({
      name: 'emails_failed_total',
      help: 'Total number of failed email send attempts',
      labelNames: ['template'],
      registers: [this.registry],
    });

    this.emailDurationSeconds = new Histogram({
      name: 'email_duration_seconds',
      help: 'Duration of email sending execution in seconds',
      labelNames: ['template'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.auditLogsTotal = new Counter({
      name: 'audit_logs_total',
      help: 'Total number of audit logs generated',
      labelNames: ['resource', 'action'],
      registers: [this.registry],
    });

    this.auditLogsFailedTotal = new Counter({
      name: 'audit_logs_failed_total',
      help: 'Total number of failed audit log processing attempts',
      labelNames: ['resource', 'action'],
      registers: [this.registry],
    });

    this.auditQueueSize = new Gauge({
      name: 'audit_queue_size',
      help: 'Current size of the audit logging queue',
      registers: [this.registry],
    });
  }

  onModuleInit(): void {
    collectDefaultMetrics({ register: this.registry });
  }

  async getMetrics(): Promise<string> {
    if (this.redisService) {
      try {
        const metrics = await this.redisService.getMetrics();
        this.redisConnected.set(metrics.status === 'ready' ? 1 : 0);
        this.redisMemoryUsageBytes.set(metrics.memoryUsageBytes);
        this.redisHitRatio.set(metrics.hitRatio);
      } catch {
        this.redisConnected.set(0);
        this.redisMemoryUsageBytes.set(0);
        this.redisHitRatio.set(0);
      }
    }

    if (this.queueService) {
      try {
        const queueMetrics = await this.queueService.getAllMetrics();
        for (const [queueName, counts] of Object.entries(queueMetrics)) {
          this.queueWaiting.set({ queue: queueName }, counts.waiting);
          this.queueActive.set({ queue: queueName }, counts.active);
          this.queueDelayed.set({ queue: queueName }, counts.delayed);
          this.queueCompleted.set({ queue: queueName }, counts.completed);
          this.queueFailed.set({ queue: queueName }, counts.failed);

          if (queueName === QUEUE_NAMES.AUDIT) {
            this.auditQueueSize.set(counts.waiting + counts.active);
          }
        }
      } catch {
        // ignore metric errors gracefully
      }
    }

    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
