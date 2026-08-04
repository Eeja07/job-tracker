import { ProjectionManager } from './projection-manager.service';
import { EventType } from '../../../modules/event-bus/enums/event-type.enum';

describe('ProjectionManager', () => {
  let manager: ProjectionManager;
  let mockReadModelService: any;
  let mockMetricsService: any;
  let mockPrisma: any;

  beforeEach(() => {
    mockReadModelService = {
      invalidatePattern: jest.fn(),
      set: jest.fn(),
    };
    mockMetricsService = {
      projectionUpdatesTotal: { inc: jest.fn() },
      projectionFailuresTotal: { inc: jest.fn() },
      projectionLatencySeconds: { observe: jest.fn() },
    };
    mockPrisma = {
      application: { count: jest.fn().mockResolvedValue(10) },
      company: { count: jest.fn().mockResolvedValue(5) },
      user: { count: jest.fn().mockResolvedValue(2) },
    };

    manager = new ProjectionManager(mockReadModelService, mockMetricsService, mockPrisma);
  });

  it('should process ApplicationCreated event and invalidate patterns', async () => {
    const event = {
      eventId: 'evt-1',
      type: EventType.APPLICATION_CREATED,
      timestamp: new Date().toISOString(),
      payload: {},
    };

    await manager.processEvent(event as any);

    expect(mockReadModelService.invalidatePattern).toHaveBeenCalledWith('dashboard');
    expect(mockReadModelService.invalidatePattern).toHaveBeenCalledWith('applications');
    expect(mockMetricsService.projectionUpdatesTotal.inc).toHaveBeenCalledWith({
      projection: 'ApplicationProjection',
      status: 'success',
    });
  });

  it('should rebuild projections from DB state', async () => {
    await manager.rebuildProjections();

    expect(mockReadModelService.set).toHaveBeenCalledWith('dashboard:global', expect.any(Object));
    expect(mockReadModelService.set).toHaveBeenCalledWith('companies:global', expect.any(Object));
    expect(mockReadModelService.set).toHaveBeenCalledWith('statistics:global', expect.any(Object));
  });
});
