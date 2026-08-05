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

import { ApiVersion } from '../../core/versioning/decorators/api-version.decorator';
import { DeprecatedEndpoint } from '../../core/versioning/decorators/deprecated-endpoint.decorator';
import { scrapeJobUrl } from './job-scraper.util';
import { JobStatusCheckerService } from './job-status-checker.service';

@ApiTags('Applications')
@ApiVersion('1')
@DeprecatedEndpoint({ sunsetDate: 'Sun, 01 Dec 2025 00:00:00 GMT', infoUrl: '/docs/v1' })
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'applications', version: '1' })
export class ApplicationsController {
  constructor(
    private readonly applicationService: ApplicationService,
    private readonly jobStatusChecker: JobStatusCheckerService,
  ) {}

  @Post('scrape-url')
  @ApiOperation({ summary: 'Scrape job details from a job portal URL' })
  @ApiResponse({ status: 200, description: 'Scraped job details' })
  async scrapeUrl(@Body('url') url: string) {
    return scrapeJobUrl(url);
  }

  @Post('check-listing-status')
  @ApiOperation({ summary: 'Check if a job listing URL is still active or closed' })
  @ApiResponse({ status: 200, description: 'Listing status result' })
  async checkListingStatus(@Body('applicationId') applicationId: string) {
    if (!applicationId) {
      return { error: 'applicationId is required' };
    }
    return this.jobStatusChecker.checkSingleListing(applicationId);
  }

  @Post('check-all-listings')
  @ApiOperation({ summary: 'Trigger a check of all active job listings for the authenticated user' })
  @ApiResponse({ status: 200, description: 'All listing check results' })
  async checkAllListings() {
    return this.jobStatusChecker.checkAllActiveListings();
  }

  @Post()
  @ApiOperation({ summary: 'Create a job application' })
  @ApiResponse({ status: 201, description: 'Application created successfully', type: ApplicationResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failure' })
  async create(
    @NestRequest() req: any,
    @Body() dto: CreateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    try {
      const authReq = req as AuthenticatedRequest;
      return await this.applicationService.create(authReq.user.sub, dto);
    } catch (err: any) {
      console.error("ERROR IN APPLICATIONS CONTROLLER CREATE:", err);
      throw err;
    }
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
