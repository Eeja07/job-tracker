import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { Application, ApplicationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ApplicationRepository } from '../../repositories/application/application.repository';
import { StatusHistoryRepository } from '../../repositories/status-history/status-history.repository';
import { RedisService } from '../redis/redis.service';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  UpdateApplicationStatusDto,
  ApplicationQueryDto,
} from './dto/application.dto';

const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  [ApplicationStatus.SAVED]: [ApplicationStatus.APPLIED, ApplicationStatus.WITHDRAWN],
  [ApplicationStatus.APPLIED]: [
    ApplicationStatus.SCREENING,
    ApplicationStatus.INTERVIEWING,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
  ],
  [ApplicationStatus.SCREENING]: [
    ApplicationStatus.INTERVIEWING,
    ApplicationStatus.OFFER,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
  ],
  [ApplicationStatus.INTERVIEWING]: [
    ApplicationStatus.OFFER,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
  ],
  [ApplicationStatus.OFFER]: [ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN],
  [ApplicationStatus.REJECTED]: [ApplicationStatus.APPLIED],
  [ApplicationStatus.WITHDRAWN]: [ApplicationStatus.APPLIED],
};

@Injectable()
export class ApplicationService {
  constructor(
    private readonly applicationRepository: ApplicationRepository,
    private readonly statusHistoryRepository: StatusHistoryRepository,
    private readonly prisma: PrismaService,
    @Optional() private readonly redisService?: RedisService,
  ) {}

  private async invalidateDashboardCache(userId: string): Promise<void> {
    if (this.redisService) {
      await this.redisService.del(`dashboard:metrics:${userId}`);
    }
  }

  async create(userId: string, dto: CreateApplicationDto): Promise<Application> {
    const deadline = dto.deadline ? new Date(dto.deadline) : undefined;
    const appliedAt = dto.appliedAt ? new Date(dto.appliedAt) : undefined;

    const result = await this.applicationRepository.create({
      ...dto,
      userId,
      deadline,
      appliedAt,
    });

    await this.invalidateDashboardCache(userId);
    return result;
  }

  async findAll(userId: string, query: ApplicationQueryDto): Promise<Application[]> {
    const deadlineBefore = query.deadlineBefore ? new Date(query.deadlineBefore) : undefined;
    const deadlineAfter = query.deadlineAfter ? new Date(query.deadlineAfter) : undefined;

    return this.applicationRepository.findWithFilters(userId, {
      ...query,
      deadlineBefore,
      deadlineAfter,
    });
  }

  async findOne(id: string, userId: string): Promise<Application> {
    const application = await this.applicationRepository.findById(id);
    if (!application || application.userId !== userId) {
      throw new NotFoundException(`Application with ID '${id}' was not found`);
    }
    return application;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateApplicationDto,
  ): Promise<Application> {
    await this.findOne(id, userId);

    const deadline = dto.deadline ? new Date(dto.deadline) : undefined;
    const appliedAt = dto.appliedAt ? new Date(dto.appliedAt) : undefined;

    const result = await this.applicationRepository.update(id, {
      ...dto,
      deadline,
      appliedAt,
    });

    await this.invalidateDashboardCache(userId);
    return result;
  }

  async updateStatus(
    id: string,
    userId: string,
    dto: UpdateApplicationStatusDto,
  ): Promise<Application> {
    const result = await this.prisma.$transaction(async (tx) => {
      const application = await this.applicationRepository.findById(id, tx);
      if (!application || application.userId !== userId) {
        throw new NotFoundException(`Application with ID '${id}' was not found`);
      }

      const fromStatus = application.status;
      if (fromStatus !== dto.status) {
        const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
        if (!allowed.includes(dto.status)) {
          throw new BadRequestException(
            `Invalid application status transition from '${fromStatus}' to '${dto.status}'`,
          );
        }
      }

      const updatedApp = await this.applicationRepository.updateStatus(id, dto.status, tx);

      await this.statusHistoryRepository.append(
        {
          applicationId: id,
          userId,
          fromStatus,
          toStatus: dto.status,
        },
        tx,
      );

      return updatedApp;
    });

    await this.invalidateDashboardCache(userId);
    return result;
  }

  async remove(id: string, userId: string): Promise<Application> {
    await this.findOne(id, userId);
    const result = await this.applicationRepository.delete(id);
    await this.invalidateDashboardCache(userId);
    return result;
  }
}
