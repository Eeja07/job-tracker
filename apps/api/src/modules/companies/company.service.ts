import {
  Injectable,
  NotFoundException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { Company } from '@prisma/client';
import { CompanyRepository } from '../../repositories/company/company.repository';
import { RedisService } from '../redis/redis.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Injectable()
export class CompanyService {
  constructor(
    private readonly companyRepository: CompanyRepository,
    @Optional() private readonly redisService?: RedisService,
  ) {}

  private async invalidateDashboardCache(): Promise<void> {
    if (this.redisService) {
      await this.redisService.delByPattern('dashboard:metrics:*');
    }
  }

  async create(dto: CreateCompanyDto): Promise<Company> {
    const existing = await this.companyRepository.findByName(dto.name);
    if (existing) {
      throw new ConflictException(`Company with name '${dto.name}' already exists`);
    }
    const result = await this.companyRepository.create(dto);
    await this.invalidateDashboardCache();
    return result;
  }

  async findAll(query: PaginationQueryDto): Promise<Company[]> {
    const searchTerm = query.search || '';
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    return this.companyRepository.search(searchTerm, skip, limit);
  }

  async findOne(id: string): Promise<Company> {
    const company = await this.companyRepository.findById(id);
    if (!company) {
      throw new NotFoundException(`Company with ID '${id}' was not found`);
    }
    return company;
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<Company> {
    const company = await this.findOne(id);

    if (dto.name && dto.name !== company.name) {
      const existing = await this.companyRepository.findByName(dto.name);
      if (existing) {
        throw new ConflictException(`Company with name '${dto.name}' already exists`);
      }
    }

    const result = await this.companyRepository.update(id, dto);
    await this.invalidateDashboardCache();
    return result;
  }

  async remove(id: string): Promise<Company> {
    await this.findOne(id);

    const count = await this.companyRepository.countAssociatedApplications(id);
    if (count > 0) {
      throw new ConflictException('Cannot delete company that is associated with job applications');
    }

    const result = await this.companyRepository.delete(id);
    await this.invalidateDashboardCache();
    return result;
  }
}
