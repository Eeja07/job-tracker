import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogRepository } from './audit-log.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuditLogRepository', () => {
  let repository: AuditLogRepository;
  let prismaService: jest.Mocked<PrismaService>;

  const mockAuditLog = {
    id: 'audit-uuid-123',
    userId: 'user-uuid-456',
    action: 'CREATE_COMPANY',
    resource: 'COMPANY',
    resourceId: 'company-uuid-789',
    method: 'POST',
    endpoint: '/api/v1/companies',
    ipAddress: '127.0.0.1',
    userAgent: 'JestTest',
    requestId: 'req-111',
    metadata: { durationMs: 12 },
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue(mockAuditLog),
        findMany: jest.fn().mockResolvedValue([mockAuditLog]),
        count: jest.fn().mockResolvedValue(1),
        findRecent: jest.fn().mockResolvedValue([mockAuditLog]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repository = module.get<AuditLogRepository>(AuditLogRepository);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create an audit log entry', async () => {
    const result = await repository.create({
      userId: 'user-uuid-456',
      action: 'CREATE_COMPANY',
      resource: 'COMPANY',
      method: 'POST',
      endpoint: '/api/v1/companies',
    });

    expect(result).toEqual(mockAuditLog);
    expect(prismaService.auditLog.create).toHaveBeenCalled();
  });

  it('should find logs by user with pagination', async () => {
    const result = await repository.findByUser('user-uuid-456', 1, 20);

    expect(result.logs).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-uuid-456' },
        skip: 0,
        take: 20,
      }),
    );
  });

  it('should find recent audit logs', async () => {
    const logs = await repository.findRecent(5);

    expect(logs).toHaveLength(1);
    expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('should search logs by filter options', async () => {
    const result = await repository.search({
      resource: 'COMPANY',
      action: 'CREATE_COMPANY',
      search: 'companies',
    });

    expect(result.logs).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(prismaService.auditLog.findMany).toHaveBeenCalled();
  });
});
