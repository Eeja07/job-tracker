import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ description: 'Company name', example: 'Tokopedia' })
  @IsString()
  @IsNotEmpty({ message: 'Company name is required' })
  name!: string;

  @ApiPropertyOptional({
    description: 'Industry classification',
    example: 'E-commerce',
  })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({
    description: 'Company website URL',
    example: 'https://tokopedia.com',
  })
  @IsOptional()
  @IsUrl({}, { message: 'Website must be a valid URL' })
  website?: string;

  @ApiPropertyOptional({
    description: 'Career page URL',
    example: 'https://tokopedia.com/careers',
  })
  @IsOptional()
  @IsUrl({}, { message: 'Career page must be a valid URL' })
  careerPage?: string;

  @ApiPropertyOptional({
    description: 'Headquarters location',
    example: 'Jakarta, Indonesia',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    description: 'Company description or notes',
    example: 'Leading tech e-commerce platform.',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}

export class CompanyResponseDto {
  @ApiProperty({ example: 'company-uuid-1' })
  id!: string;

  @ApiProperty({ example: 'Tokopedia' })
  name!: string;

  @ApiPropertyOptional({ example: 'E-commerce' })
  industry?: string | null;

  @ApiPropertyOptional({ example: 'https://tokopedia.com' })
  website?: string | null;

  @ApiPropertyOptional({ example: 'https://tokopedia.com/careers' })
  careerPage?: string | null;

  @ApiPropertyOptional({ example: 'Jakarta, Indonesia' })
  location?: string | null;

  @ApiPropertyOptional({ example: 'Leading tech e-commerce platform.' })
  description?: string | null;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  updatedAt!: Date;
}
