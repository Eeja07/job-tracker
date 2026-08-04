import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from './audit-log.service';
import { AuditLogRepository } from '../../../repositories/audit-log/audit-log.repository';
import { QueueService } from '../../jobs/services/queue.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let mockAuditLogRepository: jest.Mocked<AuditLogRepository>;
  let mockQueueService: jest.Mocked<QueueService>;

  const mockLog = {
    id: 'audit-1',
    userId: 'u-1',
    action: 'LOGIN',
    resource: 'AUTH',
    resourceId: null,
    method: 'POST',
    endpoint: '/api/v1/auth/login',
    ipAddress: '127.0.0.1',
    userAgent: 'test',
    requestId: 'req-1',
    metadata: {},
    createdAt: new Date(),
  };

  beforeEach(async () => {
    mockAuditLogRepository = {
      create: jest.fn().mockResolvedValue(mockLog),
      findByUser: jest.fn().mockResolvedValue({ logs: [mockLog], total: 1 }),
      findRecent: jest.fn().mockResolvedValue([mockLog]),
      search: jest.fn().mockResolvedValue({ logs: [mockLog], total: 1 }),
    } as any;

    mockQueueService = {
      checkHealth: jest.fn().mockResolvedValue(true),
      enqueue: jest.fn().mockResolvedValue({ id: 'job-audit-1' }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: AuditLogRepository, useValue: mockAuditLogRepository },
        { provide: QueueService, useValue: mockQueueService },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should enqueue audit event when queue is available', async () => {
    await service.recordEvent({
      action: 'LOGIN',
      resource: 'AUTH',
      method: 'POST',
      endpoint: '/api/v1/auth/login',
    });

    expect(mockQueueService.checkHealth).toHaveBeenCalled();
    expect(mockQueueService.enqueue).toHaveBeenCalledWith(
      'audit',
      'RECORD_AUDIT_LOG',
      expect.objectContaining({ action: 'LOGIN' }),
    );
    expect(mockAuditLogRepository.create).not.toHaveBeenCalled();
  });

  it('should fallback to synchronous repository creation when queue is unavailable', async () => {
    mockQueueService.checkHealth.mockResolvedValue(false);

    await service.recordEvent({
      action: 'LOGIN',
      resource: 'AUTH',
      method: 'POST',
      endpoint: '/api/v1/auth/login',
    });

    expect(mockQueueService.enqueue).not.toHaveBeenCalled();
    expect(mockAuditLogRepository.create).toHaveBeenCalled();
  });

  it('should record direct audit log entry', async () => {
    const res = await service.recordDirect({
      action: 'DIRECT_ACTION',
      resource: 'SYSTEM',
      method: 'INTERNAL',
      endpoint: '/internal',
    });

    expect(res).toEqual(mockLog);
    expect(mockAuditLogRepository.create).toHaveBeenCalled();
  });

  it('should fetch user logs, recent logs, and search logs', async () => {
    const userLogs = await service.findByUser('u-1', 1, 20);
    expect(userLogs.total).toBe(1);

    const recentLogs = await service.getRecentLogs(5);
    expect(recentLogs).toHaveLength(1);

    const searchRes = await service.searchLogs({ resource: 'AUTH' });
    expect(searchRes.total).toBe(1);
  });
});
