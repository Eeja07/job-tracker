import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { NotFoundException, ExecutionContext } from '@nestjs/common';
import { FeatureFlagGuard } from './feature-flag.guard';
import { FeatureFlagService } from '../services/feature-flag.service';
import { FEATURE_FLAG_KEY } from '../decorators/feature-flag.decorator';

describe('FeatureFlagGuard', () => {
  let guard: FeatureFlagGuard;
  let reflector: Reflector;
  let featureFlagService: FeatureFlagService;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const mockFeatureFlagService = {
    isEnabled: jest.fn(),
  };

  const mockExecutionContext = (user?: any) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: FeatureFlagService, useValue: mockFeatureFlagService },
      ],
    }).compile();

    guard = module.get<FeatureFlagGuard>(FeatureFlagGuard);
    reflector = module.get<Reflector>(Reflector);
    featureFlagService = module.get<FeatureFlagService>(FeatureFlagService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true if no FEATURE_FLAG_KEY metadata exists', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(undefined);

    const context = mockExecutionContext();
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(featureFlagService.isEnabled).not.toHaveBeenCalled();
  });

  it('should return true if feature flag is enabled for request user', async () => {
    mockReflector.getAllAndOverride.mockReturnValue('TEST_FEATURE');
    mockFeatureFlagService.isEnabled.mockResolvedValue(true);

    const context = mockExecutionContext({ sub: 'user-123' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(featureFlagService.isEnabled).toHaveBeenCalledWith('TEST_FEATURE', 'user-123');
  });

  it('should throw NotFoundException (404) if feature flag is disabled', async () => {
    mockReflector.getAllAndOverride.mockReturnValue('DISABLED_FEATURE');
    mockFeatureFlagService.isEnabled.mockResolvedValue(false);

    const context = mockExecutionContext({ id: 'user-456' });

    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
    expect(featureFlagService.isEnabled).toHaveBeenCalledWith('DISABLED_FEATURE', 'user-456');
  });
});
