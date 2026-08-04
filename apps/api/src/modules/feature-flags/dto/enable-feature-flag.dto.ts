import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class EnableFeatureFlagDto {
  @ApiProperty({ description: 'Flag enabled status', example: true })
  @IsBoolean()
  @IsNotEmpty()
  enabled: boolean;
}
