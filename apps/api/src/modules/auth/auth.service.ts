import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  Optional,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { User } from '@prisma/client';
import { UserRepository } from '../../repositories/user/user.repository';
import { RefreshSessionRepository } from '../../repositories/refresh-session/refresh-session.repository';
import { RedisService } from '../redis/redis.service';
import { RbacService } from '../rbac/services/rbac.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

import { PrismaService } from '../../prisma/prisma.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: Omit<User, 'passwordHash'>;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly inMemoryLocks = new Map<string, boolean>();
  private readonly recentTokensCache = new Map<
    string,
    { tokens: AuthTokens; expiresAt: number }
  >();

  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshSessionRepository: RefreshSessionRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Optional() private readonly prismaService?: PrismaService,
    @Optional() private readonly redisService?: RedisService,
    @Optional() private readonly rbacService?: RbacService,
  ) {}

  private async getCachedRefreshSession(userId: string) {
    const cacheKey = `auth:refresh_session:${userId}`;
    if (this.redisService) {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          return {
            ...parsed,
            expiresAt: new Date(parsed.expiresAt),
            createdAt: new Date(parsed.createdAt),
          };
        } catch {
          // ignore parse error and fallback to DB
        }
      }
    }

    const session = await this.refreshSessionRepository.findByUserId(userId);
    if (session && this.redisService) {
      const ttl = Math.max(
        1,
        Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
      );
      await this.redisService.set(cacheKey, JSON.stringify(session), ttl);
    }

    return session;
  }

  private async invalidateRefreshSessionCache(userId: string): Promise<void> {
    if (this.redisService) {
      await this.redisService.del(`auth:refresh_session:${userId}`);
    }
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const isTest = process.env.NODE_ENV === 'test';
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: isTest ? 4096 : 65536,
      timeCost: isTest ? 1 : 3,
    });

    // Atomic transaction for User creation + default USER role assignment
    const user = this.prismaService
      ? await this.prismaService.$transaction(async (tx) => {
          const createdUser = await this.userRepository.create(
            {
              email: dto.email,
              passwordHash,
              fullName: dto.fullName,
              isEmailVerified: false,
            },
            tx,
          );

          if (this.rbacService) {
            await this.rbacService.assignRole(createdUser.id, 'USER', tx);
          }

          return createdUser;
        })
      : await (async () => {
          const createdUser = await this.userRepository.create({
            email: dto.email,
            passwordHash,
            fullName: dto.fullName,
            isEmailVerified: false,
          });

          if (this.rbacService) {
            await this.rbacService.assignRole(createdUser.id, 'USER');
          }

          return createdUser;
        })();

    const tokens = await this.generateTokens(user.id, user.email);
    await this.updateRefreshTokenHash(user.id, tokens.refreshToken);

    const { passwordHash: _, ...sanitizedUser } = user;
    return {
      ...tokens,
      user: sanitizedUser,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.userRepository.update(user.id, {
      lastLoginAt: new Date(),
    });

    const tokens = await this.generateTokens(user.id, user.email);
    await this.updateRefreshTokenHash(user.id, tokens.refreshToken);

    const { passwordHash: _, ...sanitizedUser } = user;
    return {
      ...tokens,
      user: sanitizedUser,
    };
  }

  async refreshTokens(dto: RefreshTokenDto): Promise<AuthTokens> {
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'job-tracker-refresh-secret-key-2026-secure';
    let payload: { sub: string; email?: string };

    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const userId = payload.sub;
    const lockKey = `auth:lock:refresh:${userId}`;
    const recentKey = `auth:recent_tokens:${userId}`;
    const useRedis = Boolean(this.redisService && this.redisService.isReady());

    // 1. Check for active grace period tokens from concurrent refresh
    if (useRedis) {
      const recent = await this.redisService!.get(recentKey);
      if (recent) {
        try {
          return JSON.parse(recent) as AuthTokens;
        } catch {}
      }
    } else {
      const memoryRecent = this.recentTokensCache.get(userId);
      if (memoryRecent && memoryRecent.expiresAt > Date.now()) {
        return memoryRecent.tokens;
      }
    }

    // 2. Acquire lock with retry loop to prevent refresh race conditions
    let lockToken: string | null = null;
    if (useRedis) {
      let attempts = 0;
      while (attempts < 40) {
        lockToken = await this.redisService!.acquireLock(lockKey, 10);
        if (lockToken) break;

        const recentWhileWaiting = await this.redisService!.get(recentKey);
        if (recentWhileWaiting) {
          try {
            return JSON.parse(recentWhileWaiting) as AuthTokens;
          } catch {}
        }

        await new Promise((resolve) => setTimeout(resolve, 50));
        attempts++;
      }

      if (!lockToken) {
        throw new UnauthorizedException(
          'Refresh lock timeout: concurrent request in progress',
        );
      }
    } else {
      let attempts = 0;
      while (this.inMemoryLocks.get(userId) && attempts < 40) {
        const memoryRecentWhileWaiting = this.recentTokensCache.get(userId);
        if (
          memoryRecentWhileWaiting &&
          memoryRecentWhileWaiting.expiresAt > Date.now()
        ) {
          return memoryRecentWhileWaiting.tokens;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
        attempts++;
      }

      if (this.inMemoryLocks.get(userId)) {
        throw new UnauthorizedException(
          'Refresh lock timeout: concurrent request in progress',
        );
      }
      this.inMemoryLocks.set(userId, true);
    }

    try {
      const session = await this.getCachedRefreshSession(userId);
      if (!session) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      const isTokenValid = await argon2.verify(
        session.tokenHash,
        dto.refreshToken,
      );
      if (!isTokenValid) {
        if (this.redisService) {
          const recent = await this.redisService.get(recentKey);
          if (recent) {
            return JSON.parse(recent) as AuthTokens;
          }
        } else {
          const memoryRecent = this.recentTokensCache.get(userId);
          if (memoryRecent && memoryRecent.expiresAt > Date.now()) {
            return memoryRecent.tokens;
          }
        }

        await this.refreshSessionRepository.deleteByUserId(userId);
        await this.invalidateRefreshSessionCache(userId);
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const tokens = await this.generateTokens(user.id, user.email);
      await this.updateRefreshTokenHash(user.id, tokens.refreshToken);

      if (this.redisService) {
        await this.redisService.set(recentKey, JSON.stringify(tokens), 10);
      } else {
        this.recentTokensCache.set(userId, {
          tokens,
          expiresAt: Date.now() + 10000,
        });
      }

      return tokens;
    } finally {
      if (this.redisService && lockToken) {
        await this.redisService.releaseLock(lockKey, lockToken);
      } else {
        this.inMemoryLocks.delete(userId);
      }
    }
  }

  async logout(userId: string): Promise<{ success: boolean }> {
    await this.refreshSessionRepository.deleteByUserId(userId);
    await this.invalidateRefreshSessionCache(userId);
    if (this.redisService) {
      await this.redisService.del(`auth:recent_tokens:${userId}`);
    } else {
      this.recentTokensCache.delete(userId);
    }
    return { success: true };
  }

  async getProfile(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    const { passwordHash: _, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  private async generateTokens(
    userId: string,
    email: string,
  ): Promise<AuthTokens> {
    const accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'job-tracker-access-secret-key-2026-secure';
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'job-tracker-refresh-secret-key-2026-secure';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email },
        { secret: accessSecret, expiresIn: '7d' },
      ),
      this.jwtService.signAsync(
        { sub: userId },
        { secret: refreshSecret, expiresIn: '30d' },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async updateRefreshTokenHash(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const tokenHash = await argon2.hash(refreshToken, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
    });

    await this.refreshSessionRepository.deleteByUserId(userId);
    await this.invalidateRefreshSessionCache(userId);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const session = await this.refreshSessionRepository.create({
      userId,
      tokenHash,
      expiresAt,
    });

    if (this.redisService) {
      const ttlSeconds = 7 * 24 * 60 * 60;
      await this.redisService.set(
        `auth:refresh_session:${userId}`,
        JSON.stringify(session),
        ttlSeconds,
      );
    }
  }
}
