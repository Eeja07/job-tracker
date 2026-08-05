import { Injectable } from '@nestjs/common';
import { FeatureFlag, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from '../base/base.repository';

export interface CreateFeatureFlagData {
  key: string;
  description?: string | null;
  enabled?: boolean;
  rolloutPercentage?: number;
}

export interface UpdateFeatureFlagData {
  description?: string | null;
  enabled?: boolean;
  rolloutPercentage?: number;
}

@Injectable()
export class FeatureFlagRepository extends BaseRepository<Prisma.FeatureFlagDelegate> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getDelegate(
    tx?: Prisma.TransactionClient,
  ): Prisma.FeatureFlagDelegate {
    return tx ? tx.featureFlag : this.prisma.featureFlag;
  }

  async findByKey(
    key: string,
    tx?: Prisma.TransactionClient,
  ): Promise<FeatureFlag | null> {
    return this.getDelegate(tx).findUnique({
      where: { key },
    });
  }

  async findAll(tx?: Prisma.TransactionClient): Promise<FeatureFlag[]> {
    return this.getDelegate(tx).findMany({
      orderBy: { key: 'asc' },
    });
  }

  async create(
    data: CreateFeatureFlagData,
    tx?: Prisma.TransactionClient,
  ): Promise<FeatureFlag> {
    return this.getDelegate(tx).create({
      data: {
        key: data.key,
        description: data.description || null,
        enabled: data.enabled ?? false,
        rolloutPercentage: data.rolloutPercentage ?? 100,
      },
    });
  }

  async update(
    key: string,
    data: UpdateFeatureFlagData,
    tx?: Prisma.TransactionClient,
  ): Promise<FeatureFlag> {
    return this.getDelegate(tx).update({
      where: { key },
      data,
    });
  }

  async upsert(
    key: string,
    data: CreateFeatureFlagData,
    tx?: Prisma.TransactionClient,
  ): Promise<FeatureFlag> {
    return this.getDelegate(tx).upsert({
      where: { key },
      update: {
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.rolloutPercentage !== undefined && {
          rolloutPercentage: data.rolloutPercentage,
        }),
      },
      create: {
        key,
        description: data.description || null,
        enabled: data.enabled ?? false,
        rolloutPercentage: data.rolloutPercentage ?? 100,
      },
    });
  }

  async delete(
    key: string,
    tx?: Prisma.TransactionClient,
  ): Promise<FeatureFlag> {
    return this.getDelegate(tx).delete({
      where: { key },
    });
  }
}
