import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Company } from '@prisma/client';
import { CompanyService } from './company.service';
import { CompanyRepository } from '../../repositories/company/company.repository';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

describe('CompanyService', () => {
  let service: CompanyService;
  let repository: jest.Mocked<CompanyRepository>;

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
    const mockRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      search: jest.fn(),
      countAssociatedApplications: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyService,
        { provide: CompanyRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<CompanyService>(CompanyService);
    repository = module.get(CompanyRepository);
  });

  describe('create', () => {
    it('should create and return a new company', async () => {
      const dto: CreateCompanyDto = {
        name: 'Tokopedia',
        industry: 'E-commerce',
      };

      repository.findByName.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockCompany);

      const result = await service.create(dto);

      expect(repository.findByName).toHaveBeenCalledWith('Tokopedia');
      expect(repository.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockCompany);
    });

    it('should throw ConflictException if company name already exists', async () => {
      const dto: CreateCompanyDto = { name: 'Tokopedia' };

      repository.findByName.mockResolvedValue(mockCompany);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should search with page offset and limit', async () => {
      const query: PaginationQueryDto = { page: 2, limit: 10, search: 'Toko' };

      repository.search.mockResolvedValue([mockCompany]);

      const result = await service.findAll(query);

      expect(repository.search).toHaveBeenCalledWith('Toko', 10, 10); // skip = (2 - 1) * 10 = 10
      expect(result).toEqual([mockCompany]);
    });
  });

  describe('remove', () => {
    it('should delete company when no applications reference it', async () => {
      repository.findById.mockResolvedValue(mockCompany);
      repository.countAssociatedApplications.mockResolvedValue(0);
      repository.delete.mockResolvedValue(mockCompany);

      const result = await service.remove('company-uuid-1');

      expect(repository.countAssociatedApplications).toHaveBeenCalledWith(
        'company-uuid-1',
      );
      expect(repository.delete).toHaveBeenCalledWith('company-uuid-1');
      expect(result).toEqual(mockCompany);
    });

    it('should throw ConflictException when applications reference the company', async () => {
      repository.findById.mockResolvedValue(mockCompany);
      repository.countAssociatedApplications.mockResolvedValue(3);

      await expect(service.remove('company-uuid-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
