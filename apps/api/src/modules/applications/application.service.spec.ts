import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import {
  Application,
  ApplicationStatus,
  WorkMode,
  ApplicationSource,
  Currency,
} from '@prisma/client';
import { ApplicationService } from './application.service';
import { ApplicationRepository } from '../../repositories/application/application.repository';
import { StatusHistoryRepository } from '../../repositories/status-history/status-history.repository';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  UpdateApplicationStatusDto,
  ApplicationQueryDto,
} from './dto/application.dto';

describe('ApplicationService', () => {
  let service: ApplicationService;
  let applicationRepository: jest.Mocked<ApplicationRepository>;
  let statusHistoryRepository: jest.Mocked<StatusHistoryRepository>;
  let prismaService: jest.Mocked<PrismaService>;

  const mockApp: any = {
    id: 'app-uuid-1',
    userId: 'user-uuid-1',
    companyId: 'company-uuid-1',
    jobTitle: 'Senior Backend Engineer',
    applicationCode: 'APP-001',
    status: ApplicationStatus.APPLIED,
    workMode: WorkMode.REMOTE,
    source: ApplicationSource.LINKEDIN,
    salaryMin: 20000000,
    salaryMax: 30000000,
    currency: Currency.IDR,
    sourceUrl: 'https://linkedin.com/jobs/1',
    location: 'Jakarta',
    deadline: new Date('2026-08-30T00:00:00Z'),
    appliedAt: new Date('2026-08-01T00:00:00Z'),
    lastStatusChangedAt: new Date('2026-08-01T00:00:00Z'),
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
  };

  beforeEach(async () => {
    const mockAppRepo = {
      create: jest.fn(),
      findWithFilters: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      delete: jest.fn(),
    };

    const mockHistoryRepo = {
      append: jest.fn(),
    };

    const mockPrisma = {
      $transaction: jest.fn().mockImplementation((cb) => cb(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationService,
        { provide: ApplicationRepository, useValue: mockAppRepo },
        { provide: StatusHistoryRepository, useValue: mockHistoryRepo },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ApplicationService>(ApplicationService);
    applicationRepository = module.get(ApplicationRepository);
    statusHistoryRepository = module.get(StatusHistoryRepository);
    prismaService = module.get(PrismaService);
  });

  describe('create', () => {
    it('should create and return application', async () => {
      const dto: CreateApplicationDto = {
        jobTitle: 'Senior Backend Engineer',
        status: ApplicationStatus.APPLIED,
      };

      applicationRepository.create.mockResolvedValue(mockApp);

      const result = await service.create('user-uuid-1', dto);

      expect(applicationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-uuid-1',
          jobTitle: 'Senior Backend Engineer',
        }),
      );
      expect(result).toEqual(mockApp);
    });
  });

  describe('findAll', () => {
    it('should query applications with filters', async () => {
      const query: ApplicationQueryDto = {
        status: ApplicationStatus.APPLIED,
        page: 1,
        limit: 10,
      };
      applicationRepository.findWithFilters.mockResolvedValue([mockApp]);

      const result = await service.findAll('user-uuid-1', query);

      expect(applicationRepository.findWithFilters).toHaveBeenCalledWith(
        'user-uuid-1',
        expect.any(Object),
      );
      expect(result).toEqual([mockApp]);
    });
  });

  describe('findOne', () => {
    it('should return application when user owns it', async () => {
      applicationRepository.findById.mockResolvedValue(mockApp);

      const result = await service.findOne('app-uuid-1', 'user-uuid-1');

      expect(applicationRepository.findById).toHaveBeenCalledWith('app-uuid-1');
      expect(result).toEqual(mockApp);
    });

    it('should throw NotFoundException if user does not own application', async () => {
      applicationRepository.findById.mockResolvedValue(mockApp);

      await expect(
        service.findOne('app-uuid-1', 'other-user-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return application', async () => {
      const dto: UpdateApplicationDto = { jobTitle: 'Lead Backend Engineer' };
      const updated = { ...mockApp, jobTitle: 'Lead Backend Engineer' };

      applicationRepository.findById.mockResolvedValue(mockApp);
      applicationRepository.update.mockResolvedValue(updated);

      const result = await service.update('app-uuid-1', 'user-uuid-1', dto);

      expect(applicationRepository.update).toHaveBeenCalledWith(
        'app-uuid-1',
        expect.objectContaining(dto),
      );
      expect(result).toEqual(updated);
    });
  });

  describe('updateStatus', () => {
    it('should update status and record history inside a transaction for valid transition', async () => {
      const dto: UpdateApplicationStatusDto = {
        status: ApplicationStatus.INTERVIEWING,
      };
      const updated = { ...mockApp, status: ApplicationStatus.INTERVIEWING };

      applicationRepository.findById.mockResolvedValue(mockApp);
      applicationRepository.updateStatus.mockResolvedValue(updated);
      statusHistoryRepository.append.mockResolvedValue({} as never);

      const result = await service.updateStatus(
        'app-uuid-1',
        'user-uuid-1',
        dto,
      );

      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(applicationRepository.updateStatus).toHaveBeenCalledWith(
        'app-uuid-1',
        ApplicationStatus.INTERVIEWING,
        expect.anything(),
      );
      expect(statusHistoryRepository.append).toHaveBeenCalledWith(
        {
          applicationId: 'app-uuid-1',
          userId: 'user-uuid-1',
          fromStatus: ApplicationStatus.APPLIED,
          toStatus: ApplicationStatus.INTERVIEWING,
        },
        expect.anything(),
      );
      expect(result).toEqual(updated);
    });

    it('should throw BadRequestException on invalid status transition', async () => {
      const rejectedApp = { ...mockApp, status: ApplicationStatus.REJECTED };
      const dto: UpdateApplicationStatusDto = {
        status: ApplicationStatus.OFFER,
      };

      applicationRepository.findById.mockResolvedValue(rejectedApp);

      await expect(
        service.updateStatus('app-uuid-1', 'user-uuid-1', dto),
      ).rejects.toThrow();
    });
  });

  describe('remove', () => {
    it('should delete and return application', async () => {
      applicationRepository.findById.mockResolvedValue(mockApp);
      applicationRepository.delete.mockResolvedValue(mockApp);

      const result = await service.remove('app-uuid-1', 'user-uuid-1');

      expect(applicationRepository.delete).toHaveBeenCalledWith('app-uuid-1');
      expect(result).toEqual(mockApp);
    });
  });
});
