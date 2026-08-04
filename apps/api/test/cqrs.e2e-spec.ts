import { INestApplication } from '@nestjs/common';
import { createTestApp, TestAppSetup } from './test-utils';
import { CommandBus } from '../src/core/cqrs/services/command-bus.service';
import { QueryBus } from '../src/core/cqrs/services/query-bus.service';
import { ReadModelService } from '../src/core/cqrs/services/read-model.service';
import { ProjectionManager } from '../src/core/cqrs/services/projection-manager.service';
import { EventPublisherService } from '../src/modules/event-bus/services/event-publisher.service';
import { EventType } from '../src/modules/event-bus/enums/event-type.enum';

describe('CQRS Module (e2e)', () => {
  let app: INestApplication;
  let commandBus: CommandBus;
  let queryBus: QueryBus;
  let readModelService: ReadModelService;
  let projectionManager: ProjectionManager;
  let eventPublisher: EventPublisherService;

  beforeAll(async () => {
    const setup: TestAppSetup = await createTestApp();
    app = setup.app;
    commandBus = app.get(CommandBus);
    queryBus = app.get(QueryBus);
    readModelService = app.get(ReadModelService);
    projectionManager = app.get(ProjectionManager);
    eventPublisher = app.get(EventPublisherService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Command and Query Buses', () => {
    it('should list all registered command and query handlers', () => {
      const commands = commandBus.getRegisteredHandlers();
      const queries = queryBus.getRegisteredHandlers();

      expect(commands).toContain('CreateApplication');
      expect(commands).toContain('CreateCompany');
      expect(queries).toContain('GetDashboard');
      expect(queries).toContain('GetApplication');
      expect(queries).toContain('ListCompanies');
      expect(queries).toContain('Statistics');
    });
  });

  describe('Read Model & Cache Strategy', () => {
    it('should store, retrieve, and invalidate read models with 60s TTL', async () => {
      const testModel = { totalUsers: 5, totalApplications: 10, totalCompanies: 2, totalAttachments: 0, statusBreakdown: {}, generatedAt: new Date().toISOString() };
      await readModelService.set('statistics:e2e-test', testModel, 60);

      const fetched = await readModelService.get('statistics:e2e-test', 'TestQuery');
      expect(fetched).toEqual(testModel);

      await readModelService.invalidate('statistics:e2e-test');
      const afterInvalidation = await readModelService.get('statistics:e2e-test');
      expect(afterInvalidation).toBeNull();
    });
  });

  describe('Projection Updates & Replay', () => {
    it('should process ApplicationCreated projection event and invalidate cached dashboard', async () => {
      await readModelService.set('dashboard:user-e2e', { totalApplications: 1, activeApplications: 1, interviewsScheduled: 0, offersReceived: 0, rejections: 0, lastUpdated: new Date().toISOString() }, 60);

      const event = await eventPublisher.publish({
        type: EventType.APPLICATION_CREATED,
        payload: { applicationId: 'app-e2e', userId: 'user-e2e', companyId: 'comp-e2e', title: 'Developer', status: 'APPLIED' },
      });

      await projectionManager.processEvent(event);

      const cachedDashboard = await readModelService.get('dashboard:user-e2e');
      expect(cachedDashboard).toBeNull(); // Cache invalidated by projection
    });

    it('should support projection rebuild from DB', async () => {
      await projectionManager.rebuildProjections();
      const stats = await readModelService.get('statistics:global');
      expect(stats).toBeDefined();
    });
  });
});
