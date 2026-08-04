import { Injectable } from '@nestjs/common';
import { Company, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from '../base/base.repository';

export interface CreateCompanyData {
  name: string;
  industry?: string;
  website?: string;
  careerPage?: string;
  location?: string;
  description?: string;
}

export interface UpdateCompanyData {
  name?: string;
  industry?: string;
  website?: string;
  careerPage?: string;
  location?: string;
  description?: string;
}

@Injectable()
export class CompanyRepository extends BaseRepository<Prisma.CompanyDelegate> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getDelegate(tx?: Prisma.TransactionClient): Prisma.CompanyDelegate {
    return tx ? tx.company : this.prisma.company;
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<Company | null> {
    return this.getDelegate(tx).findUnique({
      where: { id },
    });
  }

  async findByName(name: string, tx?: Prisma.TransactionClient): Promise<Company | null> {
    return this.getDelegate(tx).findUnique({
      where: { name },
    });
  }

  async search(
    query: string,
    skip = 0,
    limit = 20,
    tx?: Prisma.TransactionClient,
  ): Promise<Company[]> {
    return this.getDelegate(tx).findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      skip,
      take: limit,
      orderBy: {
        name: 'asc',
      },
    });
  }

  async countAssociatedApplications(
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    return (tx || this.prisma).application.count({
      where: { companyId },
    });
  }

  async create(data: CreateCompanyData, tx?: Prisma.TransactionClient): Promise<Company> {
    return this.getDelegate(tx).create({
      data,
    });
  }

  async update(id: string, data: UpdateCompanyData, tx?: Prisma.TransactionClient): Promise<Company> {
    return this.getDelegate(tx).update({
      where: { id },
      data,
    });
  }

  async delete(id: string, tx?: Prisma.TransactionClient): Promise<Company> {
    return this.getDelegate(tx).delete({
      where: { id },
    });
  }
}
