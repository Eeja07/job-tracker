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
  Request as NestRequest,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/auth.controller';
import { ApplicationService } from './application.service';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  UpdateApplicationStatusDto,
  ApplicationQueryDto,
  ApplicationResponseDto,
} from './dto/application.dto';

@ApiTags('Applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationService: ApplicationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a job application' })
  @ApiResponse({ status: 201, description: 'Application created successfully', type: ApplicationResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failure' })
  async create(
    @NestRequest() req: any,
    @Body() dto: CreateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    const authReq = req as AuthenticatedRequest;
    return this.applicationService.create(authReq.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List and filter job applications with search, pagination, and sorting' })
  @ApiResponse({ status: 200, description: 'Paginated applications list', type: [ApplicationResponseDto] })
  async findAll(
    @NestRequest() req: any,
    @Query() query: ApplicationQueryDto,
  ): Promise<ApplicationResponseDto[]> {
    const authReq = req as AuthenticatedRequest;
    return this.applicationService.findAll(authReq.user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get application details by ID' })
  @ApiResponse({ status: 200, description: 'Application details', type: ApplicationResponseDto })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async findOne(
    @NestRequest() req: any,
    @Param('id') id: string,
  ): Promise<ApplicationResponseDto> {
    const authReq = req as AuthenticatedRequest;
    return this.applicationService.findOne(id, authReq.user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update application details' })
  @ApiResponse({ status: 200, description: 'Application updated successfully', type: ApplicationResponseDto })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async update(
    @NestRequest() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    const authReq = req as AuthenticatedRequest;
    return this.applicationService.update(id, authReq.user.sub, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update application pipeline status stage' })
  @ApiResponse({ status: 200, description: 'Status updated successfully', type: ApplicationResponseDto })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async updateStatus(
    @NestRequest() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ): Promise<ApplicationResponseDto> {
    const authReq = req as AuthenticatedRequest;
    return this.applicationService.updateStatus(id, authReq.user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete job application' })
  @ApiResponse({ status: 204, description: 'Application deleted successfully' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async remove(
    @NestRequest() req: any,
    @Param('id') id: string,
  ): Promise<void> {
    const authReq = req as AuthenticatedRequest;
    await this.applicationService.remove(id, authReq.user.sub);
  }
}
