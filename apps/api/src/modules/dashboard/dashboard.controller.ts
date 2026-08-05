import {
  Controller,
  Get,
  UseGuards,
  Request as NestRequest,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/auth.controller';
import { DashboardService } from './dashboard.service';
import { DashboardMetricsDto } from './dto/dashboard-metrics.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Get aggregated dashboard metrics for authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard metrics',
    type: DashboardMetricsDto,
  })
  async getMetrics(@NestRequest() req: any): Promise<DashboardMetricsDto> {
    const authReq = req as AuthenticatedRequest;
    return this.dashboardService.getMetrics(authReq.user.sub);
  }
}
