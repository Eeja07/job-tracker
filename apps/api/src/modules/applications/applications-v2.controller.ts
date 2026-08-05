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
  ApplicationQueryDto,
  ApplicationResponseDto,
} from './dto/application.dto';
import { ApiVersion } from '../../core/versioning/decorators/api-version.decorator';

@ApiTags('Applications v2')
@ApiVersion('2')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'applications', version: '2' })
export class ApplicationsV2Controller {
  constructor(private readonly applicationService: ApplicationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a job application (v2 API - Enhanced schema response)' })
  @ApiResponse({ status: 201, description: 'Application created successfully (v2)', type: ApplicationResponseDto })
  async create(
    @NestRequest() req: any,
    @Body() dto: CreateApplicationDto,
  ): Promise<any> {
    const authReq = req as AuthenticatedRequest;
    const result = await this.applicationService.create(authReq.user.sub, dto);
    return {
      version: 'v2',
      data: result,
      meta: { apiVersion: '2.0', timestamp: new Date().toISOString() },
    };
  }

  @Get()
  @ApiOperation({ summary: 'List job applications (v2 API - Paginated envelope format)' })
  @ApiResponse({ status: 200, description: 'v2 Paginated applications envelope' })
  async findAll(
    @NestRequest() req: any,
    @Query() query: ApplicationQueryDto,
  ): Promise<any> {
    const authReq = req as AuthenticatedRequest;
    const items = await this.applicationService.findAll(authReq.user.sub, query);
    return {
      version: 'v2',
      items,
      count: items.length,
      page: query.page || 1,
      limit: query.limit || 20,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get application details by ID (v2 API)' })
  async findOne(@NestRequest() req: any, @Param('id') id: string): Promise<any> {
    const authReq = req as AuthenticatedRequest;
    const item = await this.applicationService.findOne(id, authReq.user.sub);
    return { version: 'v2', data: item };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update application details (v2 API)' })
  async update(
    @NestRequest() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
  ): Promise<any> {
    const authReq = req as AuthenticatedRequest;
    const updated = await this.applicationService.update(id, authReq.user.sub, dto);
    return { version: 'v2', data: updated };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete application (v2 API)' })
  async remove(@NestRequest() req: any, @Param('id') id: string): Promise<void> {
    const authReq = req as AuthenticatedRequest;
    await this.applicationService.remove(id, authReq.user.sub);
  }
}
