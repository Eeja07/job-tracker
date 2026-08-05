import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { AttachmentType, StorageProvider } from '@prisma/client';

export class CreateAttachmentDto {
  @ApiProperty({
    description: 'Target job application ID',
    example: 'app-uuid-1',
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
    description: 'Human-readable label/title',
    example: 'CV 2026 Updated',
  })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiPropertyOptional({
    description: 'Original filename',
    example: 'cv_2026.pdf',
  })
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional({
    description: 'MIME type string',
    example: 'application/pdf',
  })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({ description: 'File size in bytes', example: 102400 })
  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;

  @ApiPropertyOptional({
    description: 'Storage provider plugin',
    enum: StorageProvider,
    default: StorageProvider.LOCAL,
  })
  @IsOptional()
  @IsEnum(StorageProvider)
  storageProvider?: StorageProvider = StorageProvider.LOCAL;

  @ApiProperty({
    description: 'Persistent relative or object storage path',
    example: '/uploads/cv_2026.pdf',
  })
  @IsString()
  @IsNotEmpty()
  storagePath!: string;

  @ApiPropertyOptional({
    description: 'SHA-256 checksum integrity hash',
    example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  })
  @IsOptional()
  @IsString()
  checksum?: string;

  @ApiPropertyOptional({ description: 'Resume version label', example: '1.0' })
  @IsOptional()
  @IsString()
  version?: string;
}

export class AttachmentResponseDto {
  @ApiProperty({ example: 'attachment-uuid-1' })
  id!: string;

  @ApiProperty({ example: 'app-uuid-1' })
  applicationId!: string;

  @ApiProperty({ example: 'user-uuid-1' })
  userId!: string;

  @ApiProperty({ enum: AttachmentType, example: AttachmentType.CV })
  type!: AttachmentType;

  @ApiProperty({ example: 'CV 2026 Updated' })
  label!: string;

  @ApiPropertyOptional({ example: 'cv_2026.pdf' })
  filename?: string | null;

  @ApiPropertyOptional({ example: 'application/pdf' })
  mimeType?: string | null;

  @ApiPropertyOptional({ example: 102400 })
  fileSize?: number | null;

  @ApiProperty({ enum: StorageProvider, example: StorageProvider.LOCAL })
  storageProvider!: StorageProvider;

  @ApiProperty({ example: '/uploads/cv_2026.pdf' })
  storagePath!: string;

  @ApiPropertyOptional({
    example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  })
  checksum?: string | null;

  @ApiPropertyOptional({ example: '1.0' })
  version?: string | null;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  uploadedAt!: Date;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  updatedAt!: Date;
}
