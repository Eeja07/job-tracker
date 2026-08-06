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
  IsArray,
  ValidateIf,
} from 'class-validator';
import {
  ApplicationStatus,
  WorkMode,
  ApplicationSource,
  Currency,
} from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class CreateApplicationDto {
  @ApiPropertyOptional({
    description: 'Associated Company ID',
    example: 'company-uuid-1',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({
    description: 'Job position title',
    example: 'Senior Backend Engineer',
  })
  @IsString()
  @IsNotEmpty({ message: 'Job title is required' })
  jobTitle!: string;

  @ApiPropertyOptional({
    description: 'Internal application code',
    example: 'APP-2026-001',
  })
  @IsOptional()
  @IsString()
  applicationCode?: string;

  @ApiPropertyOptional({
    description: 'Application status',
    enum: ApplicationStatus,
    default: ApplicationStatus.SAVED,
  })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiPropertyOptional({
    description: 'Stage at which application was rejected',
    example: 'HR_INTERVIEW',
  })
  @IsOptional()
  @IsString()
  rejectedAtStage?: string;

  @ApiPropertyOptional({
    description: 'Work mode arrangement',
    enum: WorkMode,
    default: WorkMode.REMOTE,
  })
  @IsOptional()
  @IsEnum(WorkMode)
  workMode?: WorkMode;

  @ApiPropertyOptional({
    description: 'Application source channel',
    enum: ApplicationSource,
    default: ApplicationSource.LINKEDIN,
  })
  @IsOptional()
  @IsEnum(ApplicationSource)
  source?: ApplicationSource;

  @ApiPropertyOptional({
    description: 'Minimum annual/monthly salary',
    example: 20000000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @ApiPropertyOptional({
    description: 'Maximum annual/monthly salary',
    example: 30000000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMax?: number;

  @ApiPropertyOptional({
    description: 'Salary currency code',
    enum: Currency,
    default: Currency.IDR,
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({
    description: 'Job listing URL',
    example: 'https://linkedin.com/jobs/1234',
  })
  @IsOptional()
  @ValidateIf((o) => typeof o.sourceUrl === 'string' && o.sourceUrl.trim().length > 0)
  @IsUrl({}, { message: 'Source URL must be a valid URL' })
  sourceUrl?: string;

  @ApiPropertyOptional({
    description: 'Job location',
    example: 'Jakarta, Indonesia',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    description: 'Application deadline timestamp',
    example: '2026-08-30T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({
    description: 'Date applied timestamp',
    example: '2026-08-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  appliedAt?: string;

  @ApiPropertyOptional({
    description: 'Company Name if companyId is unknown',
    example: 'Google',
  })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ description: 'Job requirements description' })
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiPropertyOptional({ description: 'Notes or comments' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'CV Text content' })
  @IsOptional()
  @IsString()
  cvText?: string;

  @ApiPropertyOptional({ description: 'Portfolio link or URL' })
  @IsOptional()
  @IsString()
  portfolioUrl?: string;

  @ApiPropertyOptional({ description: 'Cover letter content' })
  @IsOptional()
  @IsString()
  coverLetter?: string;

  @ApiPropertyOptional({ description: 'Notes content' })
  @IsOptional()
  @IsString()
  notesContent?: string;

  @ApiPropertyOptional({ description: 'Notes images list' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  notesImages?: string[];

  @ApiPropertyOptional({ description: 'Main image URL or base64' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'CV filename' })
  @IsOptional()
  @IsString()
  cvName?: string;

  @ApiPropertyOptional({ description: 'CV file URL or base64' })
  @IsOptional()
  @IsString()
  cvUrl?: string;

  @ApiPropertyOptional({ description: 'Portfolio filename' })
  @IsOptional()
  @IsString()
  portfolioName?: string;

  @ApiPropertyOptional({ description: 'Cover letter filename' })
  @IsOptional()
  @IsString()
  coverLetterName?: string;

  @ApiPropertyOptional({ description: 'Cover letter URL or base64' })
  @IsOptional()
  @IsString()
  coverLetterUrl?: string;

  @ApiPropertyOptional({ description: 'Cover letter text content' })
  @IsOptional()
  @IsString()
  coverLetterText?: string;
}

export class UpdateApplicationDto extends PartialType(CreateApplicationDto) {}

export class UpdateApplicationStatusDto {
  @ApiProperty({
    description: 'New pipeline status',
    enum: ApplicationStatus,
    example: ApplicationStatus.INTERVIEWING,
  })
  @IsEnum(ApplicationStatus)
  @IsNotEmpty()
  status!: ApplicationStatus;

  @ApiPropertyOptional({
    description: 'Stage at which application was rejected',
    example: 'HR_INTERVIEW',
  })
  @IsOptional()
  @IsString()
  rejectedAtStage?: string;
}

export class ApplicationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by Application Status',
    enum: ApplicationStatus,
  })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiPropertyOptional({
    description: 'Filter by Company ID',
    example: 'company-uuid-1',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({
    description: 'Filter by Application Source',
    enum: ApplicationSource,
  })
  @IsOptional()
  @IsEnum(ApplicationSource)
  source?: ApplicationSource;

  @ApiPropertyOptional({
    description: 'Filter by Deadline before timestamp',
    example: '2026-08-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  deadlineBefore?: string;

  @ApiPropertyOptional({
    description: 'Filter by Deadline after timestamp',
    example: '2026-08-01T00:00:00.000Z',
  })
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

  @ApiPropertyOptional({
    enum: ApplicationSource,
    example: ApplicationSource.LINKEDIN,
  })
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
