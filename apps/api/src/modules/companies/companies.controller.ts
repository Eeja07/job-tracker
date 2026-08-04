import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyService } from './company.service';
import { CreateCompanyDto, UpdateCompanyDto, CompanyResponseDto } from './dto/company.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new company in global registry' })
  @ApiResponse({ status: 201, description: 'Company created successfully', type: CompanyResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request - Validation error' })
  @ApiResponse({ status: 409, description: 'Conflict - Company name already exists' })
  async create(@Body() dto: CreateCompanyDto): Promise<CompanyResponseDto> {
    return this.companyService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List or search companies' })
  @ApiResponse({ status: 200, description: 'List of companies', type: [CompanyResponseDto] })
  async findAll(@Query() query: PaginationQueryDto): Promise<CompanyResponseDto[]> {
    return this.companyService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get company details by ID' })
  @ApiResponse({ status: 200, description: 'Company details', type: CompanyResponseDto })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async findOne(@Param('id') id: string): Promise<CompanyResponseDto> {
    return this.companyService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update company details' })
  @ApiResponse({ status: 200, description: 'Company updated successfully', type: CompanyResponseDto })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
  ): Promise<CompanyResponseDto> {
    return this.companyService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete company by ID' })
  @ApiResponse({ status: 204, description: 'Company deleted successfully' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.companyService.remove(id);
  }
}
