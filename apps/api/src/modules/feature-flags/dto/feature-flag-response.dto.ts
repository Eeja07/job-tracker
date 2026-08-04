import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FeatureFlagResponseDto {
  @ApiProperty({ description: 'Feature flag ID (UUID v7)' })
  id: string;

  @ApiProperty({ description: 'Unique flag key' })
  key: string;

  @ApiPropertyOptional({ description: 'Flag description' })
  description?: string | null;

  @ApiProperty({ description: 'Whether flag is enabled' })
  enabled: boolean;

  @ApiProperty({ description: 'Percentage rollout (0-100)' })
  rolloutPercentage: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}
