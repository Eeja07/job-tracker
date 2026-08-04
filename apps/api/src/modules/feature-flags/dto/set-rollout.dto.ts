import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, Max, Min } from 'class-validator';

export class SetRolloutDto {
  @ApiProperty({ description: 'Rollout percentage (100, 50, 25, 10, 5, 1, or 0-100)', example: 50 })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsNotEmpty()
  rolloutPercentage: number;
}
