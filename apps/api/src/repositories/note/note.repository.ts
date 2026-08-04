import { Injectable } from '@nestjs/common';
import { Note, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from '../base/base.repository';

export interface CreateNoteData {
  applicationId: string;
  userId: string;
  content: string;
  pinned?: boolean;
}

export interface UpdateNoteData {
  content?: string;
  pinned?: boolean;
}

@Injectable()
export class NoteRepository extends BaseRepository<Prisma.NoteDelegate> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected getDelegate(tx?: Prisma.TransactionClient): Prisma.NoteDelegate {
    return tx ? tx.note : this.prisma.note;
  }

  async findById(id: string, tx?: Prisma.TransactionClient): Promise<Note | null> {
    return this.getDelegate(tx).findUnique({
      where: { id },
    });
  }

  async findByApplication(
    applicationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Note[]> {
    return this.getDelegate(tx).findMany({
      where: { applicationId },
      orderBy: [
        { pinned: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async create(data: CreateNoteData, tx?: Prisma.TransactionClient): Promise<Note> {
    return this.getDelegate(tx).create({
      data,
    });
  }

  async update(id: string, data: UpdateNoteData, tx?: Prisma.TransactionClient): Promise<Note> {
    return this.getDelegate(tx).update({
      where: { id },
      data,
    });
  }

  async delete(id: string, tx?: Prisma.TransactionClient): Promise<Note> {
    return this.getDelegate(tx).delete({
      where: { id },
    });
  }
}
