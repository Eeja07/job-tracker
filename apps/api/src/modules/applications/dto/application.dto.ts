import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Min,
  IsDateString,
} from 'class-validator';
import { ApplicationStatus, WorkMode, ApplicationSource, Currency } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class CreateApplicationDto {
  @ApiPropertyOptional({ description: 'Associated Company ID', example: 'company-uuid-1' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({ description: 'Job position title', example: 'Senior Backend Engineer' })
  @IsString()
  @IsNotEmpty({ message: 'Job title is required' })
  jobTitle!: string;

  @ApiPropertyOptional({ description: 'Internal application code', example: 'APP-2026-001' })
  @IsOptional()
  @IsString()
  applicationCode?: string;

  @ApiPropertyOptional({ description: 'Application status', enum: ApplicationStatus, default: ApplicationStatus.SAVED })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus = ApplicationStatus.SAVED;

  @ApiPropertyOptional({ description: 'Work mode arrangement', enum: WorkMode, default: WorkMode.REMOTE })
  @IsOptional()
  @IsEnum(WorkMode)
  workMode?: WorkMode = WorkMode.REMOTE;

  @ApiPropertyOptional({ description: 'Application source channel', enum: ApplicationSource, default: ApplicationSource.LINKEDIN })
  @IsOptional()
  @IsEnum(ApplicationSource)
  source?: ApplicationSource = ApplicationSource.LINKEDIN;

  @ApiPropertyOptional({ description: 'Minimum annual/monthly salary', example: 20000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @ApiPropertyOptional({ description: 'Maximum annual/monthly salary', example: 30000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMax?: number;

  @ApiPropertyOptional({ description: 'Salary currency code', enum: Currency, default: Currency.IDR })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency = Currency.IDR;

  @ApiPropertyOptional({ description: 'Job listing URL', example: 'https://linkedin.com/jobs/1234' })
  @IsOptional()
  @IsUrl({}, { message: 'Source URL must be a valid URL' })
  sourceUrl?: string;

  @ApiPropertyOptional({ description: 'Job location', example: 'Jakarta, Indonesia' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Application deadline timestamp', example: '2026-08-30T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({ description: 'Date applied timestamp', example: '2026-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  appliedAt?: string;
}

export class UpdateApplicationDto extends PartialType(CreateApplicationDto) {}

export class UpdateApplicationStatusDto {
  @ApiProperty({ description: 'New pipeline status', enum: ApplicationStatus, example: ApplicationStatus.INTERVIEWING })
  @IsEnum(ApplicationStatus)
  @IsNotEmpty()
  status!: ApplicationStatus;
}

export class ApplicationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by Application Status', enum: ApplicationStatus })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiPropertyOptional({ description: 'Filter by Company ID', example: 'company-uuid-1' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ description: 'Filter by Application Source', enum: ApplicationSource })
  @IsOptional()
  @IsEnum(ApplicationSource)
  source?: ApplicationSource;

  @ApiPropertyOptional({ description: 'Filter by Deadline before timestamp', example: '2026-08-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  deadlineBefore?: string;

  @ApiPropertyOptional({ description: 'Filter by Deadline after timestamp', example: '2026-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  deadlineAfter?: string;
}

export class ApplicationResponseDto {
  @ApiProperty({ example: 'app-uuid-1' })
  id!: string;

  @ApiProperty({ example: 'user-uuid-1' })
  userId!: string;

  @ApiPropertyOptional({ example: 'company-uuid-1' })
  companyId?: string | null;

  @ApiProperty({ example: 'Senior Backend Engineer' })
  jobTitle!: string;

  @ApiPropertyOptional({ example: 'APP-2026-001' })
  applicationCode?: string | null;

  @ApiProperty({ enum: ApplicationStatus, example: ApplicationStatus.APPLIED })
  status!: ApplicationStatus;

  @ApiPropertyOptional({ enum: WorkMode, example: WorkMode.REMOTE })
  workMode?: WorkMode | null;

  @ApiPropertyOptional({ enum: ApplicationSource, example: ApplicationSource.LINKEDIN })
  source?: ApplicationSource | null;

  @ApiPropertyOptional({ example: 20000000 })
  salaryMin?: number | null;

  @ApiPropertyOptional({ example: 30000000 })
  salaryMax?: number | null;

  @ApiPropertyOptional({ enum: Currency, example: Currency.IDR })
  currency?: Currency | null;

  @ApiPropertyOptional({ example: 'https://linkedin.com/jobs/1234' })
  sourceUrl?: string | null;

  @ApiPropertyOptional({ example: 'Jakarta, Indonesia' })
  location?: string | null;

  @ApiPropertyOptional({ example: '2026-08-30T00:00:00.000Z' })
  deadline?: Date | null;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  appliedAt?: Date | null;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  lastStatusChangedAt!: Date;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  updatedAt!: Date;
}
