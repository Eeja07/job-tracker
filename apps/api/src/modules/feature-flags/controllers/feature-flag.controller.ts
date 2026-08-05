import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { PermissionsGuard } from '../../rbac/guards/permissions.guard';
import { Roles } from '../../rbac/decorators/rbac.decorators';
import { FeatureFlagService } from '../services/feature-flag.service';
import { CreateFeatureFlagDto } from '../dto/create-feature-flag.dto';
import { UpdateFeatureFlagDto } from '../dto/update-feature-flag.dto';
import { EnableFeatureFlagDto } from '../dto/enable-feature-flag.dto';
import { SetRolloutDto } from '../dto/set-rollout.dto';
import { FeatureFlagResponseDto } from '../dto/feature-flag-response.dto';

@ApiTags('Feature Flags')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a new feature flag' })
  @ApiResponse({
    status: 201,
    description: 'Feature flag created successfully',
    type: FeatureFlagResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires ADMIN role' })
  async create(
    @Body() dto: CreateFeatureFlagDto,
  ): Promise<FeatureFlagResponseDto> {
    return this.featureFlagService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all feature flags' })
  @ApiResponse({
    status: 200,
    description: 'List of feature flags',
    type: [FeatureFlagResponseDto],
  })
  async findAll(): Promise<FeatureFlagResponseDto[]> {
    return this.featureFlagService.getAll();
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get feature flag by key' })
  @ApiParam({ name: 'key', description: 'Feature flag key' })
  @ApiResponse({
    status: 200,
    description: 'Feature flag details',
    type: FeatureFlagResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async findByKey(@Param('key') key: string): Promise<FeatureFlagResponseDto> {
    const flag = await this.featureFlagService.get(key);
    if (!flag) {
      throw new Error(`Feature flag with key '${key}' not found.`);
    }
    return flag;
  }

  @Patch(':key/enable')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Enable or disable a feature flag' })
  @ApiParam({ name: 'key', description: 'Feature flag key' })
  @ApiResponse({
    status: 200,
    description: 'Feature flag status updated',
    type: FeatureFlagResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async setEnabled(
    @Param('key') key: string,
    @Body() dto: EnableFeatureFlagDto,
  ): Promise<FeatureFlagResponseDto> {
    return this.featureFlagService.setEnabled(key, dto.enabled);
  }

  @Patch(':key/rollout')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Set rollout percentage for a feature flag' })
  @ApiParam({ name: 'key', description: 'Feature flag key' })
  @ApiResponse({
    status: 200,
    description: 'Feature flag rollout updated',
    type: FeatureFlagResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async setRollout(
    @Param('key') key: string,
    @Body() dto: SetRolloutDto,
  ): Promise<FeatureFlagResponseDto> {
    return this.featureFlagService.setRollout(key, dto.rolloutPercentage);
  }

  @Post('refresh')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh feature flags in Redis cache' })
  @ApiResponse({ status: 200, description: 'Cache refreshed successfully' })
  async refresh(): Promise<{ message: string }> {
    await this.featureFlagService.refresh();
    return { message: 'Feature flags cache refreshed successfully' };
  }

  @Delete(':key')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a feature flag' })
  @ApiParam({ name: 'key', description: 'Feature flag key' })
  @ApiResponse({ status: 204, description: 'Feature flag deleted' })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  async delete(@Param('key') key: string): Promise<void> {
    await this.featureFlagService.delete(key);
  }
}
