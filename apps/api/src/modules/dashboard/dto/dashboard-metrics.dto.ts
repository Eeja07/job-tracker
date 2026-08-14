import { ApiProperty } from '@nestjs/swagger';

export class PipelineDistributionDto {
  @ApiProperty({ example: 5 })
  SAVED!: number;

  @ApiProperty({ example: 10 })
  APPLIED!: number;

  @ApiProperty({ example: 2 })
  ASSESSMENT!: number;

  @ApiProperty({ example: 2 })
  HR_INTERVIEW!: number;

  @ApiProperty({ example: 2 })
  USER_INTERVIEW!: number;

  @ApiProperty({ example: 3 })
  SCREENING!: number;

  @ApiProperty({ example: 4 })
  INTERVIEWING!: number;

  @ApiProperty({ example: 2 })
  OFFER!: number;

  @ApiProperty({ example: 6 })
  REJECTED!: number;

  @ApiProperty({ example: 1 })
  WITHDRAWN!: number;
}

export class TopCompanyDto {
  @ApiProperty({ example: 'company-uuid-1' })
  companyId!: string;

  @ApiProperty({ example: 'Tokopedia' })
  companyName!: string;

  @ApiProperty({ example: 4 })
  count!: number;
}

export class TopSourceDto {
  @ApiProperty({ example: 'LINKEDIN' })
  source!: string;

  @ApiProperty({ example: 12 })
  count!: number;
}

export class MonthlyTrendDto {
  @ApiProperty({ example: '2026-08' })
  month!: string;

  @ApiProperty({ example: 15 })
  count!: number;
}

export class DashboardMetricsDto {
  @ApiProperty({ example: 31 })
  totalApplications!: number;

  @ApiProperty({ type: PipelineDistributionDto })
  pipelineDistribution!: PipelineDistributionDto;

  @ApiProperty({ example: 15 })
  applicationsThisMonth!: number;

  @ApiProperty({ example: 10 })
  applicationsLastMonth!: number;

  @ApiProperty({ example: 6.45 })
  offerRate!: number;

  @ApiProperty({ example: 19.35 })
  interviewRate!: number;

  @ApiProperty({ example: 14.5 })
  averageDaysToOffer!: number;

  @ApiProperty({ type: [TopCompanyDto] })
  topCompanies!: TopCompanyDto[];

  @ApiProperty({ type: [TopSourceDto] })
  topSources!: TopSourceDto[];

  @ApiProperty({ type: [MonthlyTrendDto] })
  monthlyTrend!: MonthlyTrendDto[];
}
