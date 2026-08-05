import { Test, TestingModule } from '@nestjs/testing';
import { Application, ApplicationStatus } from '@prisma/client';
import { ApplicationsController } from './applications.controller';
import { ApplicationService } from './application.service';
import { AuthenticatedRequest } from '../auth/auth.controller';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  UpdateApplicationStatusDto,
  ApplicationQueryDto,
} from './dto/application.dto';

import { JobStatusCheckerService } from './job-status-checker.service';

describe('ApplicationsController', () => {
  let controller: ApplicationsController;
  let service: jest.Mocked<ApplicationService>;

  const mockReq = {
    user: { sub: 'user-uuid-1', email: 'test@example.com' },
  } as AuthenticatedRequest;

  const mockApp = {
    id: 'app-uuid-1',
    userId: 'user-uuid-1',
    jobTitle: 'Senior Backend Engineer',
    status: ApplicationStatus.APPLIED,
  } as Application;

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      remove: jest.fn(),
    };

    const mockJobChecker = {
      checkListingStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: [
        { provide: ApplicationService, useValue: mockService },
        { provide: JobStatusCheckerService, useValue: mockJobChecker },
      ],
    }).compile();

    controller = module.get<ApplicationsController>(ApplicationsController);
    service = module.get(ApplicationService);
  });

  describe('create', () => {
    it('should call service.create with userId and dto', async () => {
      const dto: CreateApplicationDto = { jobTitle: 'Senior Backend Engineer' };
      service.create.mockResolvedValue(mockApp);

      const result = await controller.create(mockReq as any, dto);

      expect(service.create).toHaveBeenCalledWith('user-uuid-1', dto);
      expect(result).toEqual(mockApp);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with userId and query', async () => {
      const query: ApplicationQueryDto = { page: 1, limit: 10 };
      service.findAll.mockResolvedValue([mockApp]);

      const result = await controller.findAll(mockReq as any, query);

      expect(service.findAll).toHaveBeenCalledWith('user-uuid-1', query);
      expect(result).toEqual([mockApp]);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with id and userId', async () => {
      service.findOne.mockResolvedValue(mockApp);

      const result = await controller.findOne(mockReq as any, 'app-uuid-1');

      expect(service.findOne).toHaveBeenCalledWith('app-uuid-1', 'user-uuid-1');
      expect(result).toEqual(mockApp);
    });
  });

  describe('update', () => {
    it('should call service.update with id, userId, and dto', async () => {
      const dto: UpdateApplicationDto = { jobTitle: 'Lead Engineer' };
      service.update.mockResolvedValue(mockApp);

      const result = await controller.update(mockReq as any, 'app-uuid-1', dto);

      expect(service.update).toHaveBeenCalledWith(
        'app-uuid-1',
        'user-uuid-1',
        dto,
      );
      expect(result).toEqual(mockApp);
    });
  });

  describe('updateStatus', () => {
    it('should call service.updateStatus with id, userId, and dto', async () => {
      const dto: UpdateApplicationStatusDto = {
        status: ApplicationStatus.INTERVIEWING,
      };
      service.updateStatus.mockResolvedValue(mockApp);

      const result = await controller.updateStatus(
        mockReq as any,
        'app-uuid-1',
        dto,
      );

      expect(service.updateStatus).toHaveBeenCalledWith(
        'app-uuid-1',
        'user-uuid-1',
        dto,
      );
      expect(result).toEqual(mockApp);
    });
  });

  describe('remove', () => {
    it('should call service.remove with id and userId', async () => {
      service.remove.mockResolvedValue(mockApp);

      await controller.remove(mockReq as any, 'app-uuid-1');

      expect(service.remove).toHaveBeenCalledWith('app-uuid-1', 'user-uuid-1');
    });
  });
});
