import { Test, TestingModule } from '@nestjs/testing';
import { FeatureFlagsController } from './feature-flag.controller';
import { FeatureFlagService } from '../services/feature-flag.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { PermissionsGuard } from '../../rbac/guards/permissions.guard';

describe('FeatureFlagsController', () => {
  let controller: FeatureFlagsController;
  let service: FeatureFlagService;

  const mockService = {
    create: jest.fn(),
    getAll: jest.fn(),
    get: jest.fn(),
    setEnabled: jest.fn(),
    setRollout: jest.fn(),
    refresh: jest.fn(),
    delete: jest.fn(),
  };

  const mockFlag = {
    id: 'uuid-1',
    key: 'test_flag',
    description: 'Test',
    enabled: true,
    rolloutPercentage: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeatureFlagsController],
      providers: [{ provide: FeatureFlagService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<FeatureFlagsController>(FeatureFlagsController);
    service = module.get<FeatureFlagService>(FeatureFlagService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create should invoke service.create', async () => {
    mockService.create.mockResolvedValue(mockFlag);
    const dto = { key: 'test_flag', enabled: true, rolloutPercentage: 100 };
    const res = await controller.create(dto);
    expect(service.create).toHaveBeenCalledWith(dto);
    expect(res).toEqual(mockFlag);
  });

  it('findAll should invoke service.getAll', async () => {
    mockService.getAll.mockResolvedValue([mockFlag]);
    const res = await controller.findAll();
    expect(service.getAll).toHaveBeenCalled();
    expect(res).toEqual([mockFlag]);
  });

  it('findByKey should invoke service.get', async () => {
    mockService.get.mockResolvedValue(mockFlag);
    const res = await controller.findByKey('test_flag');
    expect(service.get).toHaveBeenCalledWith('test_flag');
    expect(res).toEqual(mockFlag);
  });

  it('setEnabled should invoke service.setEnabled', async () => {
    mockService.setEnabled.mockResolvedValue({ ...mockFlag, enabled: false });
    const res = await controller.setEnabled('test_flag', { enabled: false });
    expect(service.setEnabled).toHaveBeenCalledWith('test_flag', false);
    expect(res.enabled).toBe(false);
  });

  it('setRollout should invoke service.setRollout', async () => {
    mockService.setRollout.mockResolvedValue({
      ...mockFlag,
      rolloutPercentage: 50,
    });
    const res = await controller.setRollout('test_flag', {
      rolloutPercentage: 50,
    });
    expect(service.setRollout).toHaveBeenCalledWith('test_flag', 50);
    expect(res.rolloutPercentage).toBe(50);
  });

  it('refresh should invoke service.refresh', async () => {
    mockService.refresh.mockResolvedValue(undefined);
    const res = await controller.refresh();
    expect(service.refresh).toHaveBeenCalled();
    expect(res.message).toBeDefined();
  });

  it('delete should invoke service.delete', async () => {
    mockService.delete.mockResolvedValue(undefined);
    await controller.delete('test_flag');
    expect(service.delete).toHaveBeenCalledWith('test_flag');
  });
});
