import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateFeatureFlagDto {
  @ApiPropertyOptional({ description: 'Optional feature flag description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Whether the flag is enabled' })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Rollout percentage (0 to 100)' })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  rolloutPercentage?: number;
}
