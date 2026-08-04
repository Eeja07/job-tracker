import { Test, TestingModule } from '@nestjs/testing';
import { Company, Prisma } from '@prisma/client';
import { CompanyRepository, CreateCompanyData, UpdateCompanyData } from './company.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('CompanyRepository', () => {
  let repository: CompanyRepository;
  let prismaService: jest.Mocked<PrismaService>;

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
    const mockPrisma = {
      company: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyRepository,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    repository = module.get<CompanyRepository>(CompanyRepository);
    prismaService = module.get(PrismaService);
  });

  describe('findById', () => {
    it('should return company by ID', async () => {
      (prismaService.company.findUnique as jest.Mock).mockResolvedValue(mockCompany);

      const result = await repository.findById('company-uuid-1');

      expect(prismaService.company.findUnique).toHaveBeenCalledWith({
        where: { id: 'company-uuid-1' },
      });
      expect(result).toEqual(mockCompany);
    });
  });

  describe('findByName', () => {
    it('should return company by name', async () => {
      (prismaService.company.findUnique as jest.Mock).mockResolvedValue(mockCompany);

      const result = await repository.findByName('Tokopedia');

      expect(prismaService.company.findUnique).toHaveBeenCalledWith({
        where: { name: 'Tokopedia' },
      });
      expect(result).toEqual(mockCompany);
    });
  });

  describe('search', () => {
    it('should perform case-insensitive search with default skip and limit', async () => {
      (prismaService.company.findMany as jest.Mock).mockResolvedValue([mockCompany]);

      const result = await repository.search('toko');

      expect(prismaService.company.findMany).toHaveBeenCalledWith({
        where: {
          name: {
            contains: 'toko',
            mode: 'insensitive',
          },
        },
        skip: 0,
        take: 20,
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([mockCompany]);
    });

    it('should respect custom skip, limit and transaction client', async () => {
      const mockTx = {
        company: {
          findMany: jest.fn().mockResolvedValue([mockCompany]),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await repository.search('toko', 10, 5, mockTx);

      expect(mockTx.company.findMany).toHaveBeenCalledWith({
        where: {
          name: {
            contains: 'toko',
            mode: 'insensitive',
          },
        },
        skip: 10,
        take: 5,
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([mockCompany]);
    });
  });

  describe('create', () => {
    it('should create new company', async () => {
      const createData: CreateCompanyData = {
        name: 'Tokopedia',
        industry: 'E-commerce',
      };

      (prismaService.company.create as jest.Mock).mockResolvedValue(mockCompany);

      const result = await repository.create(createData);

      expect(prismaService.company.create).toHaveBeenCalledWith({
        data: createData,
      });
      expect(result).toEqual(mockCompany);
    });
  });

  describe('update', () => {
    it('should update company', async () => {
      const updateData: UpdateCompanyData = { location: 'Jakarta South' };
      const updatedCompany = { ...mockCompany, location: 'Jakarta South' };

      (prismaService.company.update as jest.Mock).mockResolvedValue(updatedCompany);

      const result = await repository.update('company-uuid-1', updateData);

      expect(prismaService.company.update).toHaveBeenCalledWith({
        where: { id: 'company-uuid-1' },
        data: updateData,
      });
      expect(result).toEqual(updatedCompany);
    });
  });

  describe('delete', () => {
    it('should delete company', async () => {
      (prismaService.company.delete as jest.Mock).mockResolvedValue(mockCompany);

      const result = await repository.delete('company-uuid-1');

      expect(prismaService.company.delete).toHaveBeenCalledWith({
        where: { id: 'company-uuid-1' },
      });
      expect(result).toEqual(mockCompany);
    });
  });
});
