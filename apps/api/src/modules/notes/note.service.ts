import { Injectable, NotFoundException } from '@nestjs/common';
import { Note } from '@prisma/client';
import { NoteRepository } from '../../repositories/note/note.repository';
import { ApplicationRepository } from '../../repositories/application/application.repository';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto';

@Injectable()
export class NoteService {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly applicationRepository: ApplicationRepository,
  ) {}

  async create(userId: string, dto: CreateNoteDto): Promise<Note> {
    const application = await this.applicationRepository.findById(
      dto.applicationId,
    );
    if (!application || application.userId !== userId) {
      throw new NotFoundException(
        `Application with ID '${dto.applicationId}' was not found`,
      );
    }

    return this.noteRepository.create({
      applicationId: dto.applicationId,
      userId,
      content: dto.content,
      pinned: dto.pinned ?? false,
    });
  }

  async findByApplication(
    applicationId: string,
    userId: string,
  ): Promise<Note[]> {
    const application =
      await this.applicationRepository.findById(applicationId);
    if (!application || application.userId !== userId) {
      throw new NotFoundException(
        `Application with ID '${applicationId}' was not found`,
      );
    }

    return this.noteRepository.findByApplication(applicationId);
  }

  async findOne(id: string, userId: string): Promise<Note> {
    const note = await this.noteRepository.findById(id);
    if (!note || note.userId !== userId) {
      throw new NotFoundException(`Note with ID '${id}' was not found`);
    }
    return note;
  }

  async update(id: string, userId: string, dto: UpdateNoteDto): Promise<Note> {
    await this.findOne(id, userId);
    return this.noteRepository.update(id, dto);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);
    await this.noteRepository.delete(id);
  }
}
