import { Injectable } from '@nestjs/common';
import {
  Attachment,
  AttachmentType,
  StorageProvider,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from '../base/base.repository';

export interface CreateAttachmentData {
  applicationId: string;
  userId: string;
  type: AttachmentType;
  label: string;
  filename?: string;
  mimeType?: string;
  fileSize?: number;
  storageProvider?: StorageProvider;
  storagePath: string;
  checksum?: string;
  version?: string;
  uploadedAt?: Date;
}

@Injectable()
export class AttachmentRepository extends BaseRepository<Prisma.AttachmentDelegate> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getDelegate(tx?: Prisma.TransactionClient): Prisma.AttachmentDelegate {
    return tx ? tx.attachment : this.prisma.attachment;
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<Attachment | null> {
    return this.getDelegate(tx).findUnique({
      where: { id },
    });
  }

  async findByApplication(
    applicationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Attachment[]> {
    return this.getDelegate(tx).findMany({
      where: { applicationId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async create(data: CreateAttachmentData, tx?: Prisma.TransactionClient): Promise<Attachment> {
    return this.getDelegate(tx).create({
      data,
    });
  }

  async delete(id: string, tx?: Prisma.TransactionClient): Promise<Attachment> {
    return this.getDelegate(tx).delete({
      where: { id },
    });
  }
}
