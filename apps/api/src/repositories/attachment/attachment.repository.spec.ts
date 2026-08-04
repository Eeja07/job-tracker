import { Test, TestingModule } from '@nestjs/testing';
import {
  Attachment,
  AttachmentType,
  StorageProvider,
  Prisma,
} from '@prisma/client';
import {
  AttachmentRepository,
  CreateAttachmentData,
} from './attachment.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('AttachmentRepository', () => {
  let repository: AttachmentRepository;
  let prismaService: jest.Mocked<PrismaService>;

  const mockAttachment: Attachment = {
    id: 'attachment-uuid-1',
    applicationId: 'app-uuid-1',
    userId: 'user-uuid-1',
    type: AttachmentType.CV,
    label: 'CV 2026',
    filename: 'cv_2026.pdf',
    mimeType: 'application/pdf',
    fileSize: 102400,
    storageProvider: StorageProvider.LOCAL,
    storagePath: '/uploads/cv_2026.pdf',
    checksum: 'sha256-checksum',
    version: '1.0',
    uploadedAt: new Date('2026-08-01T00:00:00Z'),
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
  };

  beforeEach(async () => {
    const mockPrisma = {
      attachment: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentRepository,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    repository = module.get<AttachmentRepository>(AttachmentRepository);
    prismaService = module.get(PrismaService);
  });

  describe('findById', () => {
    it('should return attachment when found by ID', async () => {
      (prismaService.attachment.findUnique as jest.Mock).mockResolvedValue(mockAttachment);

      const result = await repository.findById('attachment-uuid-1');

      expect(prismaService.attachment.findUnique).toHaveBeenCalledWith({
        where: { id: 'attachment-uuid-1' },
      });
      expect(result).toEqual(mockAttachment);
    });

    it('should return null when attachment is not found', async () => {
      (prismaService.attachment.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should delegate to transaction client if provided', async () => {
      const mockTx = {
        attachment: {
          findUnique: jest.fn().mockResolvedValue(mockAttachment),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await repository.findById('attachment-uuid-1', mockTx);

      expect(mockTx.attachment.findUnique).toHaveBeenCalledWith({
        where: { id: 'attachment-uuid-1' },
      });
      expect(prismaService.attachment.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual(mockAttachment);
    });
  });

  describe('findByApplication', () => {
    it('should return attachments for an application ordered by uploadedAt desc', async () => {
      (prismaService.attachment.findMany as jest.Mock).mockResolvedValue([mockAttachment]);

      const result = await repository.findByApplication('app-uuid-1');

      expect(prismaService.attachment.findMany).toHaveBeenCalledWith({
        where: { applicationId: 'app-uuid-1' },
        orderBy: { uploadedAt: 'desc' },
      });
      expect(result).toEqual([mockAttachment]);
    });
  });

  describe('create', () => {
    it('should create and return a new attachment', async () => {
      const createData: CreateAttachmentData = {
        applicationId: 'app-uuid-1',
        userId: 'user-uuid-1',
        type: AttachmentType.CV,
        label: 'CV 2026',
        storagePath: '/uploads/cv_2026.pdf',
      };

      (prismaService.attachment.create as jest.Mock).mockResolvedValue(mockAttachment);

      const result = await repository.create(createData);

      expect(prismaService.attachment.create).toHaveBeenCalledWith({
        data: createData,
      });
      expect(result).toEqual(mockAttachment);
    });

    it('should propagate Prisma database errors unchanged', async () => {
      const createData: CreateAttachmentData = {
        applicationId: 'app-uuid-1',
        userId: 'user-uuid-1',
        type: AttachmentType.CV,
        label: 'CV 2026',
        storagePath: '/uploads/cv_2026.pdf',
      };

      const error = new Error('Foreign key constraint failed');
      (prismaService.attachment.create as jest.Mock).mockRejectedValue(error);

      await expect(repository.create(createData)).rejects.toThrow('Foreign key constraint failed');
    });
  });

  describe('delete', () => {
    it('should delete and return deleted attachment', async () => {
      (prismaService.attachment.delete as jest.Mock).mockResolvedValue(mockAttachment);

      const result = await repository.delete('attachment-uuid-1');

      expect(prismaService.attachment.delete).toHaveBeenCalledWith({
        where: { id: 'attachment-uuid-1' },
      });
      expect(result).toEqual(mockAttachment);
    });
  });
});
