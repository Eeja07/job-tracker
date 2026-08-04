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
      get: jest.fn().mockResolvedValue(null),
      invalidate: jest.fn(),
    };
    mockMetricsService = {
      projectionUpdatesTotal: { inc: jest.fn() },
      projectionFailuresTotal: { inc: jest.fn() },
      projectionLatencySeconds: { observe: jest.fn() },
      projectionRebuildTotal: { inc: jest.fn() },
      projectionRebuildDurationSeconds: { observe: jest.fn() },
      projectionRecordsProcessedTotal: { inc: jest.fn() },
      projectionBatchesTotal: { inc: jest.fn() },
    };
    mockPrisma = {
      application: { findMany: jest.fn().mockResolvedValue([]) },
      company: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      attachment: { findMany: jest.fn().mockResolvedValue([]) },
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

  it('should rebuild projections from DB state with cursor batching', async () => {
    mockPrisma.application.findMany
      .mockResolvedValueOnce([{ id: 'app-1', status: 'APPLIED' }, { id: 'app-2', status: 'OFFER' }])
      .mockResolvedValueOnce([{ id: 'app-3', status: 'REJECTED' }]);
    mockPrisma.company.findMany.mockResolvedValueOnce([{ id: 'comp-1' }]);
    mockPrisma.user.findMany.mockResolvedValueOnce([{ id: 'user-1' }]);
    mockPrisma.attachment.findMany.mockResolvedValueOnce([{ id: 'att-1' }]);

    await manager.rebuildProjections({ batchSize: 2 });

    expect(mockPrisma.application.findMany).toHaveBeenNthCalledWith(1, {
      take: 2,
      orderBy: { id: 'asc' },
      select: { id: true, status: true },
    });

    expect(mockPrisma.application.findMany).toHaveBeenNthCalledWith(2, {
      take: 2,
      cursor: { id: 'app-2' },
      skip: 1,
      orderBy: { id: 'asc' },
      select: { id: true, status: true },
    });

    expect(mockReadModelService.set).toHaveBeenCalledWith('dashboard:global', expect.any(Object));
    expect(mockReadModelService.set).toHaveBeenCalledWith('companies:global', expect.any(Object));
    expect(mockReadModelService.set).toHaveBeenCalledWith('statistics:global', expect.any(Object));
  });

  it('should resume rebuild from existing checkpoint', async () => {
    const existingCheckpoint = {
      model: 'company',
      lastId: 'comp-1',
      processedRecords: 5,
      totalBatches: 2,
      stats: {
        totalApplications: 5,
        activeApplications: 3,
        interviewsScheduled: 1,
        offersReceived: 1,
        rejections: 1,
        statusBreakdown: { APPLIED: 3, OFFER: 1, REJECTED: 1 },
        totalCompanies: 1,
        totalUsers: 0,
        totalAttachments: 0,
      },
    };

    mockReadModelService.get.mockResolvedValue(existingCheckpoint);
    mockPrisma.company.findMany.mockResolvedValueOnce([{ id: 'comp-2' }]);
    mockPrisma.user.findMany.mockResolvedValueOnce([{ id: 'user-1' }]);

    await manager.rebuildProjections({ resume: true, batchSize: 10 });

    expect(mockPrisma.application.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.company.findMany).toHaveBeenCalledWith({
      take: 10,
      cursor: { id: 'comp-1' },
      skip: 1,
      orderBy: { id: 'asc' },
      select: { id: true },
    });
  });

  it('should recover and persist checkpoint upon interruption', async () => {
    mockPrisma.application.findMany.mockResolvedValueOnce([{ id: 'app-1', status: 'APPLIED' }]);
    mockPrisma.company.findMany.mockRejectedValue(new Error('Database connection reset'));

    await expect(manager.rebuildProjections({ batchSize: 5 })).rejects.toThrow('Database connection reset');

    expect(mockReadModelService.set).toHaveBeenCalledWith(
      'projection:rebuild:checkpoint',
      expect.objectContaining({
        model: 'company',
        processedRecords: 1,
      }),
      86400,
    );
    expect(mockMetricsService.projectionRebuildTotal.inc).toHaveBeenCalledWith({ status: 'failure' });
  });
});
