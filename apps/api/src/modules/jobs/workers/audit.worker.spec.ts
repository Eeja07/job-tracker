import { Test, TestingModule } from '@nestjs/testing';
import { AuditWorker } from './audit.worker';
import { QueueService } from '../services/queue.service';
import { AuditLogRepository } from '../../../repositories/audit-log/audit-log.repository';
import { MetricsService } from '../../../core/metrics/metrics.service';
import { QUEUE_NAMES } from '../constants/jobs.constants';

describe('AuditWorker', () => {
  let worker: AuditWorker;
  let mockAuditLogRepository: jest.Mocked<AuditLogRepository>;
  let mockQueueService: jest.Mocked<QueueService>;
  let mockMetricsService: any;

  const mockLog = {
    id: 'audit-job-1',
    userId: 'u-1',
    action: 'CREATE_COMPANY',
    resource: 'COMPANY',
    resourceId: 'c-1',
    method: 'POST',
    endpoint: '/api/v1/companies',
    ipAddress: '127.0.0.1',
    userAgent: 'test',
    requestId: 'req-1',
    metadata: {},
    createdAt: new Date(),
  };

  beforeEach(async () => {
    mockAuditLogRepository = {
      create: jest.fn().mockResolvedValue(mockLog),
    } as any;

    mockQueueService = {
      moveToDeadLetterQueue: jest.fn().mockResolvedValue({ id: 'dlq-1' }),
    } as any;

    mockMetricsService = {
      auditLogsTotal: { inc: jest.fn() },
      auditLogsFailedTotal: { inc: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditWorker,
        { provide: QueueService, useValue: mockQueueService },
        { provide: AuditLogRepository, useValue: mockAuditLogRepository },
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    worker = module.get<AuditWorker>(AuditWorker);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should process audit log job and increment auditLogsTotal metric', async () => {
    const mockJob = {
      id: 'job-100',
      name: 'RECORD_AUDIT_LOG',
      data: {
        action: 'CREATE_COMPANY',
        resource: 'COMPANY',
        method: 'POST',
        endpoint: '/api/v1/companies',
      },
    } as any;

    const result = await worker.process(mockJob);

    expect(result).toEqual(mockLog);
    expect(mockAuditLogRepository.create).toHaveBeenCalledWith(mockJob.data);
    expect(mockMetricsService.auditLogsTotal.inc).toHaveBeenCalledWith({
      resource: 'COMPANY',
      action: 'CREATE_COMPANY',
    });
  });

  it('should move job to DLQ on failure when retry limit reached', async () => {
    const mockJob = {
      id: 'job-err-1',
      name: 'RECORD_AUDIT_LOG',
      data: { action: 'FAIL_ACTION', resource: 'TEST' },
      attemptsMade: 5,
      opts: { attempts: 5 },
    } as any;

    await worker.onFailed(mockJob, new Error('DB Connection Lost'));

    expect(mockMetricsService.auditLogsFailedTotal.inc).toHaveBeenCalledWith({
      resource: 'TEST',
      action: 'FAIL_ACTION',
    });
    expect(mockQueueService.moveToDeadLetterQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        originalQueue: QUEUE_NAMES.AUDIT,
        failedReason: 'DB Connection Lost',
        attemptsMade: 5,
      }),
    );
  });
});
