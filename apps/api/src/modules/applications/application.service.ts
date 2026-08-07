import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import {
  Application,
  ApplicationStatus,
  WorkMode,
  ApplicationSource,
  Currency,
} from '@prisma/client';
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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  [ApplicationStatus.SAVED]: Object.values(ApplicationStatus),
  [ApplicationStatus.APPLIED]: Object.values(ApplicationStatus),
  [ApplicationStatus.ASSESSMENT]: Object.values(ApplicationStatus),
  [ApplicationStatus.HR_INTERVIEW]: Object.values(ApplicationStatus),
  [ApplicationStatus.USER_INTERVIEW]: Object.values(ApplicationStatus),
  [ApplicationStatus.OFFER]: Object.values(ApplicationStatus),
  [ApplicationStatus.REJECTED]: Object.values(ApplicationStatus),
  [ApplicationStatus.WITHDRAWN]: Object.values(ApplicationStatus),
  [ApplicationStatus.SCREENING]: Object.values(ApplicationStatus),
  [ApplicationStatus.INTERVIEWING]: Object.values(ApplicationStatus),
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

  async create(
    userId: string,
    dto: CreateApplicationDto,
  ): Promise<Application> {
    let companyId = dto.companyId;

    if (companyId && !UUID_REGEX.test(companyId)) {
      companyId = undefined;
    }

    if (!companyId && dto.companyName?.trim()) {
      const trimmedName = dto.companyName.trim();
      const existingCompany = await this.prisma.company.findUnique({
        where: { name: trimmedName },
      });
      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        const newCompany = await this.prisma.company.create({
          data: { name: trimmedName },
        });
        companyId = newCompany.id;
      }
    }

    const deadline =
      dto.deadline && !isNaN(Date.parse(dto.deadline))
        ? new Date(dto.deadline)
        : undefined;
    const appliedAt =
      dto.appliedAt && !isNaN(Date.parse(dto.appliedAt))
        ? new Date(dto.appliedAt)
        : undefined;

    let rejectedAtStage = dto.rejectedAtStage || undefined;
    if (dto.status === ApplicationStatus.REJECTED && !rejectedAtStage) {
      rejectedAtStage = 'APPLIED';
    }

    const result = await this.applicationRepository.create({
      userId,
      companyId: companyId || undefined,
      jobTitle: dto.jobTitle,
      applicationCode: dto.applicationCode || undefined,
      status: dto.status || ApplicationStatus.SAVED,
      rejectedAtStage,
      workMode: dto.workMode || WorkMode.REMOTE,
      source: dto.source || ApplicationSource.LINKEDIN,
      salaryMin:
        dto.salaryMin !== undefined ? Number(dto.salaryMin) : undefined,
      salaryMax:
        dto.salaryMax !== undefined ? Number(dto.salaryMax) : undefined,
      currency: dto.currency || Currency.IDR,
      sourceUrl: dto.sourceUrl || undefined,
      location: dto.location || undefined,
      deadline,
      appliedAt,
      requirements: dto.requirements || undefined,
      notesContent: dto.notesContent || dto.notes || undefined,
      notesImages: dto.notesImages || [],
      imageUrl: dto.imageUrl || undefined,
      cvName: dto.cvName || undefined,
      cvUrl: dto.cvUrl || undefined,
      cvText: dto.cvText || undefined,
      portfolioName: dto.portfolioName || undefined,
      portfolioUrl: dto.portfolioUrl || undefined,
      coverLetterName: dto.coverLetterName || undefined,
      coverLetterUrl: dto.coverLetterUrl || dto.coverLetter || undefined,
      coverLetterText: dto.coverLetterText || dto.coverLetter || undefined,
    });

    await this.invalidateDashboardCache(userId);
    return result;
  }

  async findAllPaginated(
    userId: string,
    query: ApplicationQueryDto,
  ): Promise<{ data: Application[]; total: number; page: number; limit: number; totalPages: number }> {
    const deadlineBefore =
      query.deadlineBefore && !isNaN(Date.parse(query.deadlineBefore))
        ? new Date(query.deadlineBefore)
        : undefined;
    const deadlineAfter =
      query.deadlineAfter && !isNaN(Date.parse(query.deadlineAfter))
        ? new Date(query.deadlineAfter)
        : undefined;

    const { data, total } =
      await this.applicationRepository.findWithFiltersAndCount(userId, {
        ...query,
        deadlineBefore,
        deadlineAfter,
      });

    const page = query.page || 1;
    const limit = query.limit !== undefined ? Number(query.limit) : 20;
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;

    return { data, total, page, limit, totalPages };
  }

  async findAll(
    userId: string,
    query: ApplicationQueryDto,
  ): Promise<Application[]> {
    const deadlineBefore =
      query.deadlineBefore && !isNaN(Date.parse(query.deadlineBefore))
        ? new Date(query.deadlineBefore)
        : undefined;
    const deadlineAfter =
      query.deadlineAfter && !isNaN(Date.parse(query.deadlineAfter))
        ? new Date(query.deadlineAfter)
        : undefined;

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

  async findImageById(id: string): Promise<{ imageUrl?: string | null } | null> {
    return this.applicationRepository.findImageById(id);
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateApplicationDto,
  ): Promise<Application> {
    const existingApp = await this.findOne(id, userId);

    let companyId = dto.companyId;
    if (companyId && !UUID_REGEX.test(companyId)) {
      companyId = undefined;
    }

    if (!companyId && dto.companyName?.trim()) {
      const trimmedName = dto.companyName.trim();
      const existingCompany = await this.prisma.company.findUnique({
        where: { name: trimmedName },
      });
      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        const newCompany = await this.prisma.company.create({
          data: { name: trimmedName },
        });
        companyId = newCompany.id;
      }
    }

    const deadline =
      dto.deadline && !isNaN(Date.parse(dto.deadline))
        ? new Date(dto.deadline)
        : undefined;
    const appliedAt =
      dto.appliedAt && !isNaN(Date.parse(dto.appliedAt))
        ? new Date(dto.appliedAt)
        : undefined;

    const updateData: any = {};
    if (companyId !== undefined) updateData.companyId = companyId;
    if (dto.jobTitle !== undefined) updateData.jobTitle = dto.jobTitle;
    if (dto.applicationCode !== undefined) updateData.applicationCode = dto.applicationCode;
    if (dto.status) {
      updateData.status = dto.status;
      if (dto.status === ApplicationStatus.REJECTED) {
        updateData.rejectedAtStage = dto.rejectedAtStage || (existingApp.status !== ApplicationStatus.REJECTED ? existingApp.status : 'APPLIED');
      }
    }
    if (dto.rejectedAtStage !== undefined) updateData.rejectedAtStage = dto.rejectedAtStage;
    if (dto.workMode !== undefined) updateData.workMode = dto.workMode || null;
    if (dto.source !== undefined) updateData.source = dto.source || null;
    if (dto.salaryMin !== undefined)
      updateData.salaryMin = dto.salaryMin !== null && dto.salaryMin !== ('' as any) ? Number(dto.salaryMin) : null;
    if (dto.salaryMax !== undefined)
      updateData.salaryMax = dto.salaryMax !== null && dto.salaryMax !== ('' as any) ? Number(dto.salaryMax) : null;
    if (dto.currency) updateData.currency = dto.currency;
    if (dto.sourceUrl !== undefined) updateData.sourceUrl = dto.sourceUrl;
    if (dto.location !== undefined) updateData.location = dto.location;
    if (dto.deadline !== undefined) updateData.deadline = deadline ?? null;
    if (appliedAt) updateData.appliedAt = appliedAt;

    if (dto.requirements !== undefined)
      updateData.requirements = dto.requirements;
    if (dto.notesContent !== undefined || dto.notes !== undefined)
      updateData.notesContent = dto.notesContent ?? dto.notes ?? '';
    if (dto.notesImages !== undefined) updateData.notesImages = dto.notesImages;
    if (dto.imageUrl !== undefined) updateData.imageUrl = dto.imageUrl;
    if (dto.cvName !== undefined) updateData.cvName = dto.cvName;
    if (dto.cvUrl !== undefined) updateData.cvUrl = dto.cvUrl;
    if (dto.cvText !== undefined) updateData.cvText = dto.cvText;
    if (dto.portfolioName !== undefined)
      updateData.portfolioName = dto.portfolioName;
    if (dto.portfolioUrl !== undefined)
      updateData.portfolioUrl = dto.portfolioUrl;
    if (dto.coverLetterName !== undefined)
      updateData.coverLetterName = dto.coverLetterName;
    if (dto.coverLetterUrl !== undefined || dto.coverLetter !== undefined)
      updateData.coverLetterUrl = dto.coverLetterUrl ?? dto.coverLetter ?? '';
    if (dto.coverLetterText !== undefined)
      updateData.coverLetterText = dto.coverLetterText;

    const result = await this.applicationRepository.update(id, updateData);

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
        throw new NotFoundException(
          `Application with ID '${id}' was not found`,
        );
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

      let rejectedAtStage = dto.rejectedAtStage;
      if (dto.status === ApplicationStatus.REJECTED && !rejectedAtStage) {
        rejectedAtStage = fromStatus !== ApplicationStatus.REJECTED ? fromStatus : 'APPLIED';
      }

      const updatedApp = await tx.application.update({
        where: { id },
        data: {
          status: dto.status,
          lastStatusChangedAt: new Date(),
          ...(dto.status === ApplicationStatus.REJECTED || rejectedAtStage ? { rejectedAtStage } : {}),
        },
      });

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
