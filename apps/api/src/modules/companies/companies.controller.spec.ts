import { Test, TestingModule } from '@nestjs/testing';
import { Company } from '@prisma/client';
import { CompaniesController } from './companies.controller';
import { CompanyService } from './company.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

describe('CompaniesController', () => {
  let controller: CompaniesController;
  let service: jest.Mocked<CompanyService>;

  const mockCompany: Company = {
    id: 'company-uuid-1',
    name: 'Tokopedia',
    industry: 'E-commerce',
    website: 'https://tokopedia.com',
    careerPage: 'https://tokopedia.com/careers',
    location: 'Jakarta',
    description: 'Leading e-commerce',
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompaniesController],
      providers: [{ provide: CompanyService, useValue: mockService }],
    }).compile();

    controller = module.get<CompaniesController>(CompaniesController);
    service = module.get(CompanyService);
  });

  describe('create', () => {
    it('should call service.create and return new company', async () => {
      const dto: CreateCompanyDto = { name: 'Tokopedia' };
      service.create.mockResolvedValue(mockCompany);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockCompany);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll and return list', async () => {
      const query: PaginationQueryDto = { page: 1, limit: 20 };
      service.findAll.mockResolvedValue([mockCompany]);

      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual([mockCompany]);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne and return company', async () => {
      service.findOne.mockResolvedValue(mockCompany);

      const result = await controller.findOne('company-uuid-1');

      expect(service.findOne).toHaveBeenCalledWith('company-uuid-1');
      expect(result).toEqual(mockCompany);
    });
  });

  describe('update', () => {
    it('should call service.update and return updated company', async () => {
      const dto: UpdateCompanyDto = { location: 'Jakarta South' };
      const updated = { ...mockCompany, location: 'Jakarta South' };
      service.update.mockResolvedValue(updated);

      const result = await controller.update('company-uuid-1', dto);

      expect(service.update).toHaveBeenCalledWith('company-uuid-1', dto);
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('should call service.remove and delete company', async () => {
      service.remove.mockResolvedValue(mockCompany);

      await controller.remove('company-uuid-1');

      expect(service.remove).toHaveBeenCalledWith('company-uuid-1');
    });
  });
});
