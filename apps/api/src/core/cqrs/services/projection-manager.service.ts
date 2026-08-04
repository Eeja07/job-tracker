import { Injectable, Logger } from '@nestjs/common';
import { ReadModelService } from './read-model.service';
import { CqrsMetricsService } from './cqrs-metrics.service';
import { BaseEvent } from '../../../modules/event-bus/interfaces/base-event.interface';
import { EventType } from '../../../modules/event-bus/enums/event-type.enum';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ProjectionManager {
  private readonly logger = new Logger(ProjectionManager.name);

  constructor(
    private readonly readModelService: ReadModelService,
    private readonly metricsService: CqrsMetricsService,
    private readonly prisma: PrismaService,
  ) {}

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
      this.metricsService.projectionUpdatesTotal.inc({ projection: projectionName, status: 'success' });
      this.metricsService.projectionLatencySeconds.observe({ projection: projectionName }, durationSeconds);

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
      this.metricsService.projectionUpdatesTotal.inc({ projection: projectionName, status: 'failure' });
      this.metricsService.projectionFailuresTotal.inc({ projection: projectionName, reason: err.message });
      this.metricsService.projectionLatencySeconds.observe({ projection: projectionName }, durationSeconds);

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
   * Replay / Rebuild projections from transactional database state.
   */
  async rebuildProjections(): Promise<void> {
    this.logger.log('Starting full Projection Rebuild...');

    // 1. Rebuild Applications Read Models
    const appsCount = await this.prisma.application.count();
    await this.readModelService.set('dashboard:global', {
      totalApplications: appsCount,
      activeApplications: appsCount,
      interviewsScheduled: 0,
      offersReceived: 0,
      rejections: 0,
      lastUpdated: new Date().toISOString(),
    });

    // 2. Rebuild Companies Read Model
    const compCount = await this.prisma.company.count();
    await this.readModelService.set('companies:global', {
      items: [],
      total: compCount,
    });

    // 3. Rebuild Statistics Read Model
    const userCount = await this.prisma.user.count();
    await this.readModelService.set('statistics:global', {
      totalUsers: userCount,
      totalApplications: appsCount,
      totalCompanies: compCount,
      totalAttachments: 0,
      statusBreakdown: {},
      generatedAt: new Date().toISOString(),
    });

    this.logger.log('Projection Rebuild completed successfully.');
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
