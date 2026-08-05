import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { AttachmentType } from '@prisma/client';

export class UploadAttachmentDto {
  @ApiProperty({
    description: 'Target job application ID',
    example: 'd3b07384-d113-42a2-8356-d446973e6d8a',
  })
  @IsUUID()
  @IsNotEmpty()
  applicationId!: string;

  @ApiProperty({
    description: 'Document type tag',
    enum: AttachmentType,
    example: AttachmentType.CV,
  })
  @IsEnum(AttachmentType)
  @IsNotEmpty()
  type!: AttachmentType;

  @ApiProperty({
    description: 'Human-readable document label',
    example: 'Senior Backend Resume 2026',
  })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiPropertyOptional({ description: 'Version string tag', example: '1.0' })
  @IsOptional()
  @IsString()
  version?: string;
}
