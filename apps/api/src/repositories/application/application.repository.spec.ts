import { Test, TestingModule } from '@nestjs/testing';
import {
  Application,
  ApplicationStatus,
  WorkMode,
  ApplicationSource,
  Currency,
  Prisma,
} from '@prisma/client';
import {
  ApplicationRepository,
  CreateApplicationData,
  UpdateApplicationData,
} from './application.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('ApplicationRepository', () => {
  let repository: ApplicationRepository;
  let prismaService: jest.Mocked<PrismaService>;

  const mockApplication: Application = {
    id: 'app-uuid-1',
    userId: 'user-uuid-1',
    companyId: 'company-uuid-1',
    jobTitle: 'Backend Engineer',
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
    const mockPrisma = {
      application: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationRepository,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    repository = module.get<ApplicationRepository>(ApplicationRepository);
    prismaService = module.get(PrismaService);
  });

  describe('findById', () => {
    it('should return application by ID with company relation included', async () => {
      (prismaService.application.findUnique as jest.Mock).mockResolvedValue(mockApplication);

      const result = await repository.findById('app-uuid-1');

      expect(prismaService.application.findUnique).toHaveBeenCalledWith({
        where: { id: 'app-uuid-1' },
        include: { company: true },
      });
      expect(result).toEqual(mockApplication);
    });
  });

  describe('findByUser', () => {
    it('should return applications for a specific user ordered by appliedAt desc', async () => {
      (prismaService.application.findMany as jest.Mock).mockResolvedValue([mockApplication]);

      const result = await repository.findByUser('user-uuid-1');

      expect(prismaService.application.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1' },
        include: {
          company: { select: { id: true, name: true } },
        },
        orderBy: { appliedAt: 'desc' },
        take: 50,
      });
      expect(result).toEqual([mockApplication]);
    });
  });

  describe('findByStatus', () => {
    it('should return applications filtered by status', async () => {
      (prismaService.application.findMany as jest.Mock).mockResolvedValue([mockApplication]);

      const result = await repository.findByStatus('user-uuid-1', ApplicationStatus.APPLIED);

      expect(prismaService.application.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1', status: ApplicationStatus.APPLIED },
        include: {
          company: { select: { id: true, name: true } },
        },
        orderBy: { lastStatusChangedAt: 'desc' },
      });
      expect(result).toEqual([mockApplication]);
    });
  });

  describe('findRecent', () => {
    it('should return recent applications with default limit', async () => {
      (prismaService.application.findMany as jest.Mock).mockResolvedValue([mockApplication]);

      const result = await repository.findRecent('user-uuid-1');

      expect(prismaService.application.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1' },
        include: {
          company: { select: { id: true, name: true } },
        },
        orderBy: { lastStatusChangedAt: 'desc' },
        take: 5,
      });
      expect(result).toEqual([mockApplication]);
    });
  });

  describe('create', () => {
    it('should create new job application', async () => {
      const createData: CreateApplicationData = {
        userId: 'user-uuid-1',
        jobTitle: 'Backend Engineer',
      };

      (prismaService.application.create as jest.Mock).mockResolvedValue(mockApplication);

      const result = await repository.create(createData);

      expect(prismaService.application.create).toHaveBeenCalledWith({
        data: createData,
      });
      expect(result).toEqual(mockApplication);
    });
  });

  describe('updateStatus', () => {
    it('should update application status and lastStatusChangedAt timestamp', async () => {
      const updatedApp = {
        ...mockApplication,
        status: ApplicationStatus.INTERVIEWING,
      };

      (prismaService.application.update as jest.Mock).mockResolvedValue(updatedApp);

      const result = await repository.updateStatus('app-uuid-1', ApplicationStatus.INTERVIEWING);

      expect(prismaService.application.update).toHaveBeenCalledWith({
        where: { id: 'app-uuid-1' },
        data: {
          status: ApplicationStatus.INTERVIEWING,
          lastStatusChangedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(updatedApp);
    });
  });

  describe('update', () => {
    it('should update application fields', async () => {
      const updateData: UpdateApplicationData = { jobTitle: 'Senior Backend Engineer' };
      const updatedApp = { ...mockApplication, jobTitle: 'Senior Backend Engineer' };

      (prismaService.application.update as jest.Mock).mockResolvedValue(updatedApp);

      const result = await repository.update('app-uuid-1', updateData);

      expect(prismaService.application.update).toHaveBeenCalledWith({
        where: { id: 'app-uuid-1' },
        data: updateData,
      });
      expect(result).toEqual(updatedApp);
    });
  });

  describe('delete', () => {
    it('should delete application', async () => {
      (prismaService.application.delete as jest.Mock).mockResolvedValue(mockApplication);

      const result = await repository.delete('app-uuid-1');

      expect(prismaService.application.delete).toHaveBeenCalledWith({
        where: { id: 'app-uuid-1' },
      });
      expect(result).toEqual(mockApplication);
    });
  });
});
