import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApplicationStatus } from '@prisma/client';

export class CreateStatusHistoryDto {
  @ApiProperty({
    description: 'Target job application ID',
    example: 'app-uuid-1',
  })
  @IsUUID()
  @IsNotEmpty()
  applicationId!: string;

  @ApiPropertyOptional({
    description: 'Previous pipeline status',
    enum: ApplicationStatus,
    example: ApplicationStatus.SAVED,
  })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  fromStatus?: ApplicationStatus;

  @ApiProperty({
    description: 'New target pipeline status',
    enum: ApplicationStatus,
    example: ApplicationStatus.APPLIED,
  })
  @IsEnum(ApplicationStatus)
  @IsNotEmpty()
  toStatus!: ApplicationStatus;
}

export class StatusHistoryResponseDto {
  @ApiProperty({ example: 'history-uuid-1' })
  id!: string;

  @ApiProperty({ example: 'app-uuid-1' })
  applicationId!: string;

  @ApiProperty({ example: 'user-uuid-1' })
  userId!: string;

  @ApiPropertyOptional({
    enum: ApplicationStatus,
    example: ApplicationStatus.SAVED,
  })
  fromStatus?: ApplicationStatus | null;

  @ApiProperty({ enum: ApplicationStatus, example: ApplicationStatus.APPLIED })
  toStatus!: ApplicationStatus;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  createdAt!: Date;
}
