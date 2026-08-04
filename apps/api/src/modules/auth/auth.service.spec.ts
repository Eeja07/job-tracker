import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { User, RefreshSession } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { UserRepository } from '../../repositories/user/user.repository';
import { RefreshSessionRepository } from '../../repositories/refresh-session/refresh-session.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let refreshSessionRepository: jest.Mocked<RefreshSessionRepository>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser: User = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    fullName: 'Test User',
    avatarUrl: null,
    isEmailVerified: false,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSession: RefreshSession = {
    id: 'session-uuid-1',
    userId: 'user-uuid-1',
    tokenHash: 'hashed-refresh-token',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockUserRepo = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const mockRefreshRepo = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      deleteByUserId: jest.fn(),
    };

    const mockJwt = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    const mockConfig = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'JWT_ACCESS_SECRET') return 'test-access-secret';
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        throw new Error(`Missing key ${key}`);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: mockUserRepo },
        { provide: RefreshSessionRepository, useValue: mockRefreshRepo },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(UserRepository);
    refreshSessionRepository = module.get(RefreshSessionRepository);
    jwtService = module.get(JwtService);
  });

  describe('register', () => {
    it('should hash password and create new user with tokens', async () => {
      const dto: RegisterDto = {
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
      };

      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(mockUser);
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      refreshSessionRepository.deleteByUserId.mockResolvedValue({ count: 0 });
      refreshSessionRepository.create.mockResolvedValue(mockSession);

      const result = await service.register(dto);

      expect(userRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(userRepository.create).toHaveBeenCalled();
      expect(refreshSessionRepository.create).toHaveBeenCalled();
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw ConflictException if email exists', async () => {
      const dto: RegisterDto = {
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
      };

      userRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should authenticate user and return tokens', async () => {
      const dto: LoginDto = { email: 'test@example.com', password: 'password123' };
      const hash = await argon2.hash('password123');

      userRepository.findByEmail.mockResolvedValue({ ...mockUser, passwordHash: hash });
      userRepository.update.mockResolvedValue(mockUser);
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      refreshSessionRepository.deleteByUserId.mockResolvedValue({ count: 0 });
      refreshSessionRepository.create.mockResolvedValue(mockSession);

      const result = await service.login(dto);

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens when valid session exists in DB', async () => {
      const dto: RefreshTokenDto = { refreshToken: 'valid-refresh-token' };
      const tokenHash = await argon2.hash('valid-refresh-token');

      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-uuid-1' });
      refreshSessionRepository.findByUserId.mockResolvedValue({ ...mockSession, tokenHash });
      userRepository.findById.mockResolvedValue(mockUser);
      jwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      const result = await service.refreshTokens(dto);

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should throw UnauthorizedException if session is missing', async () => {
      const dto: RefreshTokenDto = { refreshToken: 'invalid-token' };
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-uuid-1' });
      refreshSessionRepository.findByUserId.mockResolvedValue(null);

      await expect(service.refreshTokens(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should delete session from repository', async () => {
      refreshSessionRepository.deleteByUserId.mockResolvedValue({ count: 1 });

      const result = await service.logout('user-uuid-1');

      expect(refreshSessionRepository.deleteByUserId).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toEqual({ success: true });
    });
  });
});
