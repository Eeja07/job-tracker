import { Test, TestingModule } from '@nestjs/testing';
import { StatusHistory, ApplicationStatus, Prisma } from '@prisma/client';
import {
  StatusHistoryRepository,
  CreateStatusHistoryData,
} from './status-history.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('StatusHistoryRepository', () => {
  let repository: StatusHistoryRepository;
  let prismaService: jest.Mocked<PrismaService>;

  const mockHistory: StatusHistory = {
    id: 'history-uuid-1',
    applicationId: 'app-uuid-1',
    userId: 'user-uuid-1',
    fromStatus: ApplicationStatus.SAVED,
    toStatus: ApplicationStatus.APPLIED,
    createdAt: new Date('2026-08-01T00:00:00Z'),
  };

  beforeEach(async () => {
    const mockPrisma = {
      statusHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatusHistoryRepository,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    repository = module.get<StatusHistoryRepository>(StatusHistoryRepository);
    prismaService = module.get(PrismaService);
  });

  describe('append', () => {
    it('should append a new status history entry', async () => {
      const appendData: CreateStatusHistoryData = {
        applicationId: 'app-uuid-1',
        userId: 'user-uuid-1',
        fromStatus: ApplicationStatus.SAVED,
        toStatus: ApplicationStatus.APPLIED,
      };

      (prismaService.statusHistory.create as jest.Mock).mockResolvedValue(
        mockHistory,
      );

      const result = await repository.append(appendData);

      expect(prismaService.statusHistory.create).toHaveBeenCalledWith({
        data: appendData,
      });
      expect(result).toEqual(mockHistory);
    });

    it('should delegate to transaction client if provided', async () => {
      const appendData: CreateStatusHistoryData = {
        applicationId: 'app-uuid-1',
        userId: 'user-uuid-1',
        toStatus: ApplicationStatus.APPLIED,
      };

      const mockTx = {
        statusHistory: {
          create: jest.fn().mockResolvedValue(mockHistory),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await repository.append(appendData, mockTx);

      expect(mockTx.statusHistory.create).toHaveBeenCalledWith({
        data: appendData,
      });
      expect(prismaService.statusHistory.create).not.toHaveBeenCalled();
      expect(result).toEqual(mockHistory);
    });
  });

  describe('findTimeline', () => {
    it('should return chronological status timeline for an application', async () => {
      (prismaService.statusHistory.findMany as jest.Mock).mockResolvedValue([
        mockHistory,
      ]);

      const result = await repository.findTimeline('app-uuid-1');

      expect(prismaService.statusHistory.findMany).toHaveBeenCalledWith({
        where: { applicationId: 'app-uuid-1' },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual([mockHistory]);
    });
  });
});
