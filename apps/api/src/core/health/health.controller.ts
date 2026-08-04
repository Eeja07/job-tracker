import { Controller, Get, HttpCode, HttpStatus, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../modules/redis/redis.service';
import { QueueService } from '../../modules/jobs/services/queue.service';
import { EmailService } from '../../modules/email/services/email.service';

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  uptime: number;
  checks?: Record<string, string>;
}

@ApiTags('Observability')
@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly redisService?: RedisService,
    @Optional() private readonly queueService?: QueueService,
    @Optional() private readonly emailService?: EmailService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Overall health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async check(): Promise<HealthCheckResponse> {
    let redisCheck = 'down';
    let jobsCheck = 'down';
    let smtpCheck = 'down';
    let auditQueueCheck = 'down';
    let rbacCacheCheck = 'down';

    try {
      if (this.redisService) {
        await this.redisService.ping();
        redisCheck = 'up';
        rbacCacheCheck = 'up';
      }
    } catch {
      redisCheck = 'down';
      rbacCacheCheck = 'down';
    }

    try {
      if (this.queueService) {
        const isHealthy = await this.queueService.checkHealth();
        jobsCheck = isHealthy ? 'up' : 'down';
        auditQueueCheck = isHealthy ? 'up' : 'down';
      }
    } catch {
      jobsCheck = 'down';
      auditQueueCheck = 'down';
    }

    try {
      if (this.emailService) {
        const isHealthy = await this.emailService.verifyConnection();
        smtpCheck = isHealthy ? 'up' : 'down';
      }
    } catch {
      smtpCheck = 'down';
    }

    const isDegraded =
      redisCheck === 'down' ||
      jobsCheck === 'down' ||
      smtpCheck === 'down' ||
      auditQueueCheck === 'down' ||
      rbacCacheCheck === 'down';

    return {
      status: isDegraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks: {
        redis: redisCheck,
        jobs: jobsCheck,
        smtp: smtpCheck,
        auditQueue: auditQueueCheck,
        rbacCache: rbacCacheCheck,
      },
    };
  }

  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe check' })
  @ApiResponse({ status: 200, description: 'Process is alive' })
  liveness(): HealthCheckResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Readiness probe check including database, redis, queue, and smtp connections' })
  @ApiResponse({ status: 200, description: 'Service is ready to handle traffic' })
  @ApiResponse({ status: 503, description: 'Service or database unavailable' })
  async readiness(): Promise<HealthCheckResponse> {
    let dbStatus = 'down';
    let redisStatus = 'down';
    let jobsStatus = 'down';
    let smtpStatus = 'down';
    let auditQueueStatus = 'down';
    let rbacCacheStatus = 'down';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'up';
    } catch {
      dbStatus = 'down';
    }

    try {
      if (this.redisService) {
        await this.redisService.ping();
        redisStatus = 'up';
        rbacCacheStatus = 'up';
      }
    } catch {
      redisStatus = 'down';
      rbacCacheStatus = 'down';
    }

    try {
      if (this.queueService) {
        const isHealthy = await this.queueService.checkHealth();
        jobsStatus = isHealthy ? 'up' : 'down';
        auditQueueStatus = isHealthy ? 'up' : 'down';
      }
    } catch {
      jobsStatus = 'down';
      auditQueueStatus = 'down';
    }

    try {
      if (this.emailService) {
        const isHealthy = await this.emailService.verifyConnection();
        smtpStatus = isHealthy ? 'up' : 'down';
      }
    } catch {
      smtpStatus = 'down';
    }

    if (dbStatus === 'down') {
      throw new ServiceUnavailableException({
        status: 'down',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        checks: {
          database: dbStatus,
          redis: redisStatus,
          jobs: jobsStatus,
          smtp: smtpStatus,
          auditQueue: auditQueueStatus,
          rbacCache: rbacCacheStatus,
        },
      });
    }

    const isDegraded =
      redisStatus === 'down' ||
      jobsStatus === 'down' ||
      smtpStatus === 'down' ||
      auditQueueStatus === 'down' ||
      rbacCacheStatus === 'down';

    return {
      status: isDegraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks: {
        database: dbStatus,
        redis: redisStatus,
        jobs: jobsStatus,
        smtp: smtpStatus,
        auditQueue: auditQueueStatus,
        rbacCache: rbacCacheStatus,
      },
    };
  }

  @Get('startup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Startup probe check' })
  @ApiResponse({ status: 200, description: 'Application has started up successfully' })
  startup(): HealthCheckResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}
