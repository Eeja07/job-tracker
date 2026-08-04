import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateStatusHistoryDto, StatusHistoryResponseDto } from './dto/status-history.dto';

@ApiTags('Status History')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('status-history')
export class StatusHistoryController {
  @Post()
  @ApiOperation({ summary: 'Append status transition log' })
  @ApiResponse({ status: 201, description: 'Status log appended', type: StatusHistoryResponseDto })
  async append(@Body() _dto: CreateStatusHistoryDto): Promise<StatusHistoryResponseDto> {
    throw new Error('Contract placeholder - not implemented');
  }

  @Get()
  @ApiOperation({ summary: 'Get status timeline for an application' })
  @ApiResponse({ status: 200, description: 'Status history timeline', type: [StatusHistoryResponseDto] })
  async findTimeline(
    @Query('applicationId') _applicationId: string,
  ): Promise<StatusHistoryResponseDto[]> {
    throw new Error('Contract placeholder - not implemented');
  }
}
