import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { User } from '@prisma/client';
import { UserRepository } from '../../repositories/user/user.repository';
import { RefreshSessionRepository } from '../../repositories/refresh-session/refresh-session.repository';
import { RedisService } from '../redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: Omit<User, 'passwordHash'>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshSessionRepository: RefreshSessionRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Optional() private readonly redisService?: RedisService,
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
      const ttl = Math.max(1, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
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

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
    });

    const user = await this.userRepository.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      isEmailVerified: false,
    });

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

    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
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
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    let payload: { sub: string; email?: string };

    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const userId = payload.sub;
    const session = await this.getCachedRefreshSession(userId);

    if (!session) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const isTokenValid = await argon2.verify(session.tokenHash, dto.refreshToken);
    if (!isTokenValid) {
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

    return tokens;
  }

  async logout(userId: string): Promise<{ success: boolean }> {
    await this.refreshSessionRepository.deleteByUserId(userId);
    await this.invalidateRefreshSessionCache(userId);
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

  private async generateTokens(userId: string, email: string): Promise<AuthTokens> {
    const accessSecret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email },
        { secret: accessSecret, expiresIn: '15m' },
      ),
      this.jwtService.signAsync(
        { sub: userId },
        { secret: refreshSecret, expiresIn: '7d' },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async updateRefreshTokenHash(userId: string, refreshToken: string): Promise<void> {
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
      await this.redisService.set(`auth:refresh_session:${userId}`, JSON.stringify(session), ttlSeconds);
    }
  }
}
