import { Injectable, Logger } from '@nestjs/common';
import { ReadModelService } from './read-model.service';
import { CqrsMetricsService } from './cqrs-metrics.service';
import { BaseEvent } from '../../../modules/event-bus/interfaces/base-event.interface';
import { EventType } from '../../../modules/event-bus/enums/event-type.enum';
import { PrismaService } from '../../../prisma/prisma.service';

export interface RebuildOptions {
  batchSize?: number;
  resume?: boolean;
}

export type ProjectionModel =
  | 'application'
  | 'company'
  | 'user'
  | 'attachment'
  | 'completed';

export interface RebuildCheckpoint {
  model: ProjectionModel;
  lastId?: string;
  processedRecords: number;
  totalBatches: number;
  stats: {
    totalApplications: number;
    activeApplications: number;
    interviewsScheduled: number;
    offersReceived: number;
    rejections: number;
    statusBreakdown: Record<string, number>;
    totalCompanies: number;
    totalUsers: number;
    totalAttachments: number;
  };
}

@Injectable()
export class ProjectionManager {
  private readonly logger = new Logger(ProjectionManager.name);
  private readonly CHECKPOINT_KEY = 'projection:rebuild:checkpoint';

  constructor(
    private readonly readModelService: ReadModelService,
    private readonly metricsService: CqrsMetricsService,
    private readonly prisma: PrismaService,
  ) {}

  private async getCheckpoint(): Promise<RebuildCheckpoint | null> {
    try {
      return await this.readModelService.get<RebuildCheckpoint>(
        this.CHECKPOINT_KEY,
      );
    } catch {
      return null;
    }
  }

  private async saveCheckpoint(checkpoint: RebuildCheckpoint): Promise<void> {
    await this.readModelService.set(this.CHECKPOINT_KEY, checkpoint, 86400);
  }

  private async clearCheckpoint(): Promise<void> {
    await this.readModelService.invalidate(this.CHECKPOINT_KEY);
  }

  /**
   * Process incoming event asynchronously to update read models.
   */
  async processEvent(event: BaseEvent): Promise<void> {
    const projectionName = this.getProjectionNameForEvent(event.type);
    const startTime = Date.now();
    const eventId = event.eventId;
    const traceId = event.traceId || 'unknown';
    const correlationId = event.correlationId || 'unknown';

    this.logger.log(
      JSON.stringify({
        message: 'Processing projection event',
        projectionName,
        eventType: event.type,
        eventId,
        traceId,
        correlationId,
      }),
    );

    try {
      switch (event.type) {
        case EventType.APPLICATION_CREATED:
        case EventType.APPLICATION_UPDATED:
        case EventType.APPLICATION_STATUS_CHANGED:
          await this.updateApplicationProjections(event);
          break;

        case EventType.COMPANY_CREATED:
        case EventType.COMPANY_DELETED:
          await this.updateCompanyProjections(event);
          break;

        case EventType.ATTACHMENT_UPLOADED:
        case EventType.ATTACHMENT_DELETED:
          await this.updateAttachmentProjections(event);
          break;

        case EventType.ROLE_ASSIGNED:
        case EventType.ROLE_REMOVED:
          await this.updateRoleProjections(event);
          break;

        case EventType.AUDIT_CREATED:
          await this.updateAuditProjections(event);
          break;

        case EventType.FEATURE_FLAG_UPDATED:
          await this.updateFeatureFlagProjections(event);
          break;

        default:
          break;
      }

      const durationSeconds = (Date.now() - startTime) / 1000;
      this.metricsService.projectionUpdatesTotal?.inc({
        projection: projectionName,
        status: 'success',
      });
      this.metricsService.projectionLatencySeconds?.observe(
        { projection: projectionName },
        durationSeconds,
      );

      this.logger.log(
        JSON.stringify({
          message: 'Projection updated successfully',
          projectionName,
          eventType: event.type,
          eventId,
          durationSeconds,
        }),
      );
    } catch (err: any) {
      const durationSeconds = (Date.now() - startTime) / 1000;
      this.metricsService.projectionUpdatesTotal?.inc({
        projection: projectionName,
        status: 'failure',
      });
      this.metricsService.projectionFailuresTotal?.inc({
        projection: projectionName,
        reason: err.message,
      });
      this.metricsService.projectionLatencySeconds?.observe(
        { projection: projectionName },
        durationSeconds,
      );

      this.logger.error(
        JSON.stringify({
          message: 'Projection update failed',
          projectionName,
          eventType: event.type,
          eventId,
          error: err.message,
        }),
      );
      throw err; // Allow subscriber retry mechanism to handle backoff
    }
  }

  /**
   * Replay / Rebuild projections from transactional database state using cursor-based batching.
   */
  async rebuildProjections(options: RebuildOptions = {}): Promise<void> {
    const batchSize =
      options.batchSize && options.batchSize > 0 ? options.batchSize : 1000;
    const shouldResume = options.resume ?? true;
    const startTime = Date.now();

    this.logger.log(
      `Starting Projection Rebuild (batchSize: ${batchSize}, resume: ${shouldResume})...`,
    );

    let checkpoint: RebuildCheckpoint | null = null;
    if (shouldResume) {
      checkpoint = await this.getCheckpoint();
    }

    if (checkpoint && checkpoint.model !== 'completed') {
      this.logger.log(
        JSON.stringify({
          message: 'Resuming projection rebuild from checkpoint',
          model: checkpoint.model,
          lastId: checkpoint.lastId,
          processedRecords: checkpoint.processedRecords,
          totalBatches: checkpoint.totalBatches,
        }),
      );
    } else {
      checkpoint = {
        model: 'application',
        lastId: undefined,
        processedRecords: 0,
        totalBatches: 0,
        stats: {
          totalApplications: 0,
          activeApplications: 0,
          interviewsScheduled: 0,
          offersReceived: 0,
          rejections: 0,
          statusBreakdown: {},
          totalCompanies: 0,
          totalUsers: 0,
          totalAttachments: 0,
        },
      };
      await this.saveCheckpoint(checkpoint);
    }

    try {
      // 1. Process Applications
      if (checkpoint.model === 'application') {
        while (checkpoint.model === 'application') {
          const batch = this.prisma.application?.findMany
            ? await this.prisma.application.findMany({
                take: batchSize,
                ...(checkpoint.lastId
                  ? { skip: 1, cursor: { id: checkpoint.lastId } }
                  : {}),
                orderBy: { id: 'asc' },
                select: { id: true, status: true },
              })
            : [];

          if (batch.length === 0) {
            checkpoint.model = 'company';
            checkpoint.lastId = undefined;
            await this.saveCheckpoint(checkpoint);
            break;
          }

          for (const item of batch) {
            checkpoint.stats.totalApplications++;
            const statusStr = String(item.status);
            checkpoint.stats.statusBreakdown[statusStr] =
              (checkpoint.stats.statusBreakdown[statusStr] || 0) + 1;

            if (
              statusStr === 'APPLIED' ||
              statusStr === 'SCREENING' ||
              statusStr === 'INTERVIEWING'
            ) {
              checkpoint.stats.activeApplications++;
            }
            if (statusStr === 'INTERVIEWING') {
              checkpoint.stats.interviewsScheduled++;
            }
            if (statusStr === 'OFFER') {
              checkpoint.stats.offersReceived++;
            }
            if (statusStr === 'REJECTED') {
              checkpoint.stats.rejections++;
            }
          }

          checkpoint.lastId = batch[batch.length - 1].id;
          checkpoint.processedRecords += batch.length;
          checkpoint.totalBatches++;

          this.metricsService.projectionRecordsProcessedTotal?.inc(
            { model: 'application' },
            batch.length,
          );
          this.metricsService.projectionBatchesTotal?.inc({
            model: 'application',
          });

          this.logger.log(
            JSON.stringify({
              message: 'Processed application batch',
              batchSize: batch.length,
              totalProcessed: checkpoint.processedRecords,
              totalBatches: checkpoint.totalBatches,
              lastId: checkpoint.lastId,
            }),
          );

          if (batch.length < batchSize) {
            checkpoint.model = 'company';
            checkpoint.lastId = undefined;
          }
          await this.saveCheckpoint(checkpoint);
        }
      }

      // 2. Process Companies
      if (checkpoint.model === 'company') {
        while (checkpoint.model === 'company') {
          const batch = this.prisma.company?.findMany
            ? await this.prisma.company.findMany({
                take: batchSize,
                ...(checkpoint.lastId
                  ? { skip: 1, cursor: { id: checkpoint.lastId } }
                  : {}),
                orderBy: { id: 'asc' },
                select: { id: true },
              })
            : [];

          if (batch.length === 0) {
            checkpoint.model = 'user';
            checkpoint.lastId = undefined;
            await this.saveCheckpoint(checkpoint);
            break;
          }

          checkpoint.stats.totalCompanies += batch.length;
          checkpoint.lastId = batch[batch.length - 1].id;
          checkpoint.processedRecords += batch.length;
          checkpoint.totalBatches++;

          this.metricsService.projectionRecordsProcessedTotal?.inc(
            { model: 'company' },
            batch.length,
          );
          this.metricsService.projectionBatchesTotal?.inc({ model: 'company' });

          this.logger.log(
            JSON.stringify({
              message: 'Processed company batch',
              batchSize: batch.length,
              totalProcessed: checkpoint.processedRecords,
              totalBatches: checkpoint.totalBatches,
              lastId: checkpoint.lastId,
            }),
          );

          if (batch.length < batchSize) {
            checkpoint.model = 'user';
            checkpoint.lastId = undefined;
          }
          await this.saveCheckpoint(checkpoint);
        }
      }

      // 3. Process Users
      if (checkpoint.model === 'user') {
        while (checkpoint.model === 'user') {
          const batch = this.prisma.user?.findMany
            ? await this.prisma.user.findMany({
                take: batchSize,
                ...(checkpoint.lastId
                  ? { skip: 1, cursor: { id: checkpoint.lastId } }
                  : {}),
                orderBy: { id: 'asc' },
                select: { id: true },
              })
            : [];

          if (batch.length === 0) {
            checkpoint.model = 'attachment';
            checkpoint.lastId = undefined;
            await this.saveCheckpoint(checkpoint);
            break;
          }

          checkpoint.stats.totalUsers += batch.length;
          checkpoint.lastId = batch[batch.length - 1].id;
          checkpoint.processedRecords += batch.length;
          checkpoint.totalBatches++;

          this.metricsService.projectionRecordsProcessedTotal?.inc(
            { model: 'user' },
            batch.length,
          );
          this.metricsService.projectionBatchesTotal?.inc({ model: 'user' });

          this.logger.log(
            JSON.stringify({
              message: 'Processed user batch',
              batchSize: batch.length,
              totalProcessed: checkpoint.processedRecords,
              totalBatches: checkpoint.totalBatches,
              lastId: checkpoint.lastId,
            }),
          );

          if (batch.length < batchSize) {
            checkpoint.model = 'attachment';
            checkpoint.lastId = undefined;
          }
          await this.saveCheckpoint(checkpoint);
        }
      }

      // 4. Process Attachments
      if (checkpoint.model === 'attachment') {
        while (checkpoint.model === 'attachment') {
          const batch = this.prisma.attachment?.findMany
            ? await this.prisma.attachment.findMany({
                take: batchSize,
                ...(checkpoint.lastId
                  ? { skip: 1, cursor: { id: checkpoint.lastId } }
                  : {}),
                orderBy: { id: 'asc' },
                select: { id: true },
              })
            : [];

          if (batch.length === 0) {
            checkpoint.model = 'completed';
            checkpoint.lastId = undefined;
            await this.saveCheckpoint(checkpoint);
            break;
          }

          checkpoint.stats.totalAttachments += batch.length;
          checkpoint.lastId = batch[batch.length - 1].id;
          checkpoint.processedRecords += batch.length;
          checkpoint.totalBatches++;

          this.metricsService.projectionRecordsProcessedTotal?.inc(
            { model: 'attachment' },
            batch.length,
          );
          this.metricsService.projectionBatchesTotal?.inc({
            model: 'attachment',
          });

          this.logger.log(
            JSON.stringify({
              message: 'Processed attachment batch',
              batchSize: batch.length,
              totalProcessed: checkpoint.processedRecords,
              totalBatches: checkpoint.totalBatches,
              lastId: checkpoint.lastId,
            }),
          );

          if (batch.length < batchSize) {
            checkpoint.model = 'completed';
            checkpoint.lastId = undefined;
          }
          await this.saveCheckpoint(checkpoint);
        }
      }

      // 5. Update Global Read Models
      await this.readModelService.set('dashboard:global', {
        totalApplications: checkpoint.stats.totalApplications,
        activeApplications: checkpoint.stats.activeApplications,
        interviewsScheduled: checkpoint.stats.interviewsScheduled,
        offersReceived: checkpoint.stats.offersReceived,
        rejections: checkpoint.stats.rejections,
        lastUpdated: new Date().toISOString(),
      });

      await this.readModelService.set('companies:global', {
        items: [],
        total: checkpoint.stats.totalCompanies,
      });

      await this.readModelService.set('statistics:global', {
        totalUsers: checkpoint.stats.totalUsers,
        totalApplications: checkpoint.stats.totalApplications,
        totalCompanies: checkpoint.stats.totalCompanies,
        totalAttachments: checkpoint.stats.totalAttachments,
        statusBreakdown: checkpoint.stats.statusBreakdown,
        generatedAt: new Date().toISOString(),
      });

      await this.clearCheckpoint();

      const durationSeconds = (Date.now() - startTime) / 1000;
      this.metricsService.projectionRebuildTotal?.inc({ status: 'success' });
      this.metricsService.projectionRebuildDurationSeconds?.observe(
        durationSeconds,
      );

      this.logger.log(
        JSON.stringify({
          message: 'Projection Rebuild completed successfully',
          totalProcessed: checkpoint.processedRecords,
          totalBatches: checkpoint.totalBatches,
          durationSeconds,
        }),
      );
    } catch (err: any) {
      this.metricsService.projectionRebuildTotal?.inc({ status: 'failure' });
      this.logger.error(
        JSON.stringify({
          message: 'Projection Rebuild failed',
          error: err.message,
          lastCheckpoint: checkpoint,
        }),
      );
      throw err;
    }
  }

  private getProjectionNameForEvent(eventType: EventType | string): string {
    if (eventType.includes('Application')) return 'ApplicationProjection';
    if (eventType.includes('Company')) return 'CompanyProjection';
    if (eventType.includes('Attachment')) return 'AttachmentProjection';
    if (eventType.includes('Role')) return 'RoleProjection';
    if (eventType.includes('Audit')) return 'AuditProjection';
    if (eventType.includes('FeatureFlag')) return 'FeatureFlagProjection';
    return 'GenericProjection';
  }

  private async updateApplicationProjections(event: BaseEvent): Promise<void> {
    await this.readModelService.invalidatePattern('dashboard');
    await this.readModelService.invalidatePattern('applications');
    await this.readModelService.invalidatePattern('statistics');
    await this.readModelService.invalidatePattern('search');
    await this.readModelService.invalidatePattern('recent_jobs');
  }

  private async updateCompanyProjections(event: BaseEvent): Promise<void> {
    await this.readModelService.invalidatePattern('companies');
    await this.readModelService.invalidatePattern('statistics');
    await this.readModelService.invalidatePattern('search');
  }

  private async updateAttachmentProjections(event: BaseEvent): Promise<void> {
    await this.readModelService.invalidatePattern('statistics');
    await this.readModelService.invalidatePattern('applications');
  }

  private async updateRoleProjections(event: BaseEvent): Promise<void> {
    await this.readModelService.invalidatePattern('dashboard');
    await this.readModelService.invalidatePattern('statistics');
  }

  private async updateAuditProjections(event: BaseEvent): Promise<void> {
    await this.readModelService.invalidatePattern('activity_timeline');
  }

  private async updateFeatureFlagProjections(event: BaseEvent): Promise<void> {
    await this.readModelService.invalidatePattern('dashboard');
  }

  /** Health probe helper */
  isHealthy(): boolean {
    return true;
  }
}
