import { Test, TestingModule } from '@nestjs/testing';
import { Note, Prisma } from '@prisma/client';
import { NoteRepository, CreateNoteData, UpdateNoteData } from './note.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('NoteRepository', () => {
  let repository: NoteRepository;
  let prismaService: jest.Mocked<PrismaService>;

  const mockNote: Note = {
    id: 'note-uuid-1',
    applicationId: 'app-uuid-1',
    userId: 'user-uuid-1',
    content: 'Interview prep notes',
    pinned: true,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
  };

  beforeEach(async () => {
    const mockPrisma = {
      note: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NoteRepository,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    repository = module.get<NoteRepository>(NoteRepository);
    prismaService = module.get(PrismaService);
  });

  describe('findById', () => {
    it('should return note when found by ID', async () => {
      (prismaService.note.findUnique as jest.Mock).mockResolvedValue(mockNote);

      const result = await repository.findById('note-uuid-1');

      expect(prismaService.note.findUnique).toHaveBeenCalledWith({
        where: { id: 'note-uuid-1' },
      });
      expect(result).toEqual(mockNote);
    });

    it('should return null when note is not found', async () => {
      (prismaService.note.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should delegate to transaction client if provided', async () => {
      const mockTx = {
        note: {
          findUnique: jest.fn().mockResolvedValue(mockNote),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await repository.findById('note-uuid-1', mockTx);

      expect(mockTx.note.findUnique).toHaveBeenCalledWith({
        where: { id: 'note-uuid-1' },
      });
      expect(prismaService.note.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual(mockNote);
    });
  });

  describe('findByApplication', () => {
    it('should return notes for an application ordered by pinned desc and createdAt desc', async () => {
      (prismaService.note.findMany as jest.Mock).mockResolvedValue([mockNote]);

      const result = await repository.findByApplication('app-uuid-1');

      expect(prismaService.note.findMany).toHaveBeenCalledWith({
        where: { applicationId: 'app-uuid-1' },
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      });
      expect(result).toEqual([mockNote]);
    });
  });

  describe('create', () => {
    it('should create and return a new note', async () => {
      const createData: CreateNoteData = {
        applicationId: 'app-uuid-1',
        userId: 'user-uuid-1',
        content: 'Interview prep notes',
        pinned: true,
      };

      (prismaService.note.create as jest.Mock).mockResolvedValue(mockNote);

      const result = await repository.create(createData);

      expect(prismaService.note.create).toHaveBeenCalledWith({
        data: createData,
      });
      expect(result).toEqual(mockNote);
    });

    it('should propagate Prisma database errors unchanged', async () => {
      const createData: CreateNoteData = {
        applicationId: 'invalid-app-id',
        userId: 'user-uuid-1',
        content: 'Test content',
      };

      const error = new Error('Foreign key constraint failed');
      (prismaService.note.create as jest.Mock).mockRejectedValue(error);

      await expect(repository.create(createData)).rejects.toThrow('Foreign key constraint failed');
    });
  });

  describe('update', () => {
    it('should update note fields and return updated note', async () => {
      const updateData: UpdateNoteData = {
        content: 'Updated content',
      };
      const updatedNote = { ...mockNote, content: 'Updated content' };

      (prismaService.note.update as jest.Mock).mockResolvedValue(updatedNote);

      const result = await repository.update('note-uuid-1', updateData);

      expect(prismaService.note.update).toHaveBeenCalledWith({
        where: { id: 'note-uuid-1' },
        data: updateData,
      });
      expect(result).toEqual(updatedNote);
    });
  });

  describe('delete', () => {
    it('should delete and return deleted note', async () => {
      (prismaService.note.delete as jest.Mock).mockResolvedValue(mockNote);

      const result = await repository.delete('note-uuid-1');

      expect(prismaService.note.delete).toHaveBeenCalledWith({
        where: { id: 'note-uuid-1' },
      });
      expect(result).toEqual(mockNote);
    });
  });
});
