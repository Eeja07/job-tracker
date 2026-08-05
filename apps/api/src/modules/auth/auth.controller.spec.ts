import { Test, TestingModule } from '@nestjs/testing';
import { AuthController, AuthenticatedRequest } from './auth.controller';
import { AuthService, AuthResponse, AuthTokens } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { User } from '@prisma/client';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockUser: Omit<User, 'passwordHash'> = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    fullName: 'Test User',
    avatarUrl: null,
    isEmailVerified: false,
    lastLoginAt: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
  };

  const mockAuthResponse: AuthResponse = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    user: mockUser,
  };

  beforeEach(async () => {
    const mockService = {
      register: jest.fn(),
      login: jest.fn(),
      refreshTokens: jest.fn(),
      logout: jest.fn(),
      getProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  describe('register', () => {
    it('should call AuthService.register and return AuthResponse', async () => {
      const dto: RegisterDto = {
        email: 'test@example.com',
        password: 'Password123!@#',
        fullName: 'Test User',
      };

      authService.register.mockResolvedValue(mockAuthResponse);

      const result = await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockAuthResponse);
    });
  });

  describe('login', () => {
    it('should call AuthService.login and return AuthResponse', async () => {
      const dto: LoginDto = {
        email: 'test@example.com',
        password: 'Password123!@#',
      };

      authService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockAuthResponse);
    });
  });

  describe('refresh', () => {
    it('should call AuthService.refreshTokens and return new AuthTokens', async () => {
      const dto: RefreshTokenDto = { refreshToken: 'valid-refresh-token' };
      const tokens: AuthTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      authService.refreshTokens.mockResolvedValue(tokens);

      const result = await controller.refresh(dto);

      expect(authService.refreshTokens).toHaveBeenCalledWith(dto);
      expect(result).toEqual(tokens);
    });
  });

  describe('logout', () => {
    it('should call AuthService.logout with user ID from request', async () => {
      const mockReq = {
        user: { sub: 'user-uuid-1', email: 'test@example.com' },
      } as AuthenticatedRequest;

      authService.logout.mockResolvedValue({ success: true });

      const result = await controller.logout(mockReq);

      expect(authService.logout).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('getProfile', () => {
    it('should call AuthService.getProfile with user ID from request', async () => {
      const mockReq = {
        user: { sub: 'user-uuid-1', email: 'test@example.com' },
      } as AuthenticatedRequest;

      authService.getProfile.mockResolvedValue(mockUser);

      const result = await controller.getProfile(mockReq);

      expect(authService.getProfile).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toEqual(mockUser);
    });
  });
});
