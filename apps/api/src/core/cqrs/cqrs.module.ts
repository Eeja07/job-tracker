import { Global, Module, OnModuleInit } from '@nestjs/common';
import { CommandBus } from './services/command-bus.service';
import { QueryBus } from './services/query-bus.service';
import { ReadModelService } from './services/read-model.service';
import { ProjectionManager } from './services/projection-manager.service';
import { CqrsMetricsService } from './services/cqrs-metrics.service';
import { ProjectionSubscriber } from './subscribers/projection.subscriber';
import { PrismaModule } from '../../prisma/prisma.module';
import { EventBusModule } from '../../modules/event-bus/event-bus.module';

// Handlers
import { CreateApplicationHandler, UpdateApplicationHandler, DeleteApplicationHandler } from './commands/application.commands';
import { CreateCompanyHandler, UpdateCompanyHandler, DeleteCompanyHandler } from './commands/company.commands';
import { AssignRoleHandler, RemoveRoleHandler } from './commands/role.commands';
import { UploadAttachmentHandler, DeleteAttachmentHandler } from './commands/attachment.commands';

import { GetDashboardHandler } from './queries/dashboard.queries';
import { GetApplicationHandler, ListApplicationsHandler, SearchApplicationsHandler } from './queries/application.queries';
import { GetCompanyHandler, ListCompaniesHandler, SearchCompaniesHandler } from './queries/company.queries';
import { StatisticsHandler, GetRecentJobsHandler } from './queries/statistics.queries';
import { ActivityTimelineHandler } from './queries/activity.queries';

const COMMAND_HANDLERS = [
  CreateApplicationHandler,
  UpdateApplicationHandler,
  DeleteApplicationHandler,
  CreateCompanyHandler,
  UpdateCompanyHandler,
  DeleteCompanyHandler,
  AssignRoleHandler,
  RemoveRoleHandler,
  UploadAttachmentHandler,
  DeleteAttachmentHandler,
];

const QUERY_HANDLERS = [
  GetDashboardHandler,
  GetApplicationHandler,
  ListApplicationsHandler,
  SearchApplicationsHandler,
  GetCompanyHandler,
  ListCompaniesHandler,
  SearchCompaniesHandler,
  StatisticsHandler,
  GetRecentJobsHandler,
  ActivityTimelineHandler,
];

@Global()
@Module({
  imports: [PrismaModule, EventBusModule],
  providers: [
    CommandBus,
    QueryBus,
    ReadModelService,
    ProjectionManager,
    CqrsMetricsService,
    ProjectionSubscriber,
    ...COMMAND_HANDLERS,
    ...QUERY_HANDLERS,
  ],
  exports: [
    CommandBus,
    QueryBus,
    ReadModelService,
    ProjectionManager,
    CqrsMetricsService,
  ],
})
export class CqrsModule implements OnModuleInit {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly createApplicationHandler: CreateApplicationHandler,
    private readonly updateApplicationHandler: UpdateApplicationHandler,
    private readonly deleteApplicationHandler: DeleteApplicationHandler,
    private readonly createCompanyHandler: CreateCompanyHandler,
    private readonly updateCompanyHandler: UpdateCompanyHandler,
    private readonly deleteCompanyHandler: DeleteCompanyHandler,
    private readonly assignRoleHandler: AssignRoleHandler,
    private readonly removeRoleHandler: RemoveRoleHandler,
    private readonly uploadAttachmentHandler: UploadAttachmentHandler,
    private readonly deleteAttachmentHandler: DeleteAttachmentHandler,

    private readonly getDashboardHandler: GetDashboardHandler,
    private readonly getApplicationHandler: GetApplicationHandler,
    private readonly listApplicationsHandler: ListApplicationsHandler,
    private readonly searchApplicationsHandler: SearchApplicationsHandler,
    private readonly getCompanyHandler: GetCompanyHandler,
    private readonly listCompaniesHandler: ListCompaniesHandler,
    private readonly searchCompaniesHandler: SearchCompaniesHandler,
    private readonly statisticsHandler: StatisticsHandler,
    private readonly getRecentJobsHandler: GetRecentJobsHandler,
    private readonly activityTimelineHandler: ActivityTimelineHandler,
  ) {}

  onModuleInit(): void {
    // Register Command Handlers
    this.commandBus.registerHandler(this.createApplicationHandler);
    this.commandBus.registerHandler(this.updateApplicationHandler);
    this.commandBus.registerHandler(this.deleteApplicationHandler);
    this.commandBus.registerHandler(this.createCompanyHandler);
    this.commandBus.registerHandler(this.updateCompanyHandler);
    this.commandBus.registerHandler(this.deleteCompanyHandler);
    this.commandBus.registerHandler(this.assignRoleHandler);
    this.commandBus.registerHandler(this.removeRoleHandler);
    this.commandBus.registerHandler(this.uploadAttachmentHandler);
    this.commandBus.registerHandler(this.deleteAttachmentHandler);

    // Register Query Handlers
    this.queryBus.registerHandler(this.getDashboardHandler);
    this.queryBus.registerHandler(this.getApplicationHandler);
    this.queryBus.registerHandler(this.listApplicationsHandler);
    this.queryBus.registerHandler(this.searchApplicationsHandler);
    this.queryBus.registerHandler(this.getCompanyHandler);
    this.queryBus.registerHandler(this.listCompaniesHandler);
    this.queryBus.registerHandler(this.searchCompaniesHandler);
    this.queryBus.registerHandler(this.statisticsHandler);
    this.queryBus.registerHandler(this.getRecentJobsHandler);
    this.queryBus.registerHandler(this.activityTimelineHandler);
  }
}
