import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AttachmentService } from './attachment.service';
import { AttachmentRepository } from '../../repositories/attachment/attachment.repository';
import { ApplicationRepository } from '../../repositories/application/application.repository';
import { StorageService } from '../storage/storage.service';
import { AttachmentType, StorageProvider } from '@prisma/client';

describe('AttachmentService', () => {
  let service: AttachmentService;

  const mockAttachmentRepository = {
    findById: jest.fn(),
    findByApplication: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };

  const mockApplicationRepository = {
    findById: jest.fn(),
  };

  const mockStorageService = {
    uploadFile: jest.fn(),
    downloadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentService,
        { provide: AttachmentRepository, useValue: mockAttachmentRepository },
        { provide: ApplicationRepository, useValue: mockApplicationRepository },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<AttachmentService>(AttachmentService);
  });

  it('should upload attachment file and save metadata', async () => {
    const userId = 'user-1';
    const dto = {
      applicationId: 'app-1',
      type: AttachmentType.CV,
      label: 'My Resume',
      version: '1.0',
    };

    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'resume.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: Buffer.from('pdf data'),
      size: 8,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    mockApplicationRepository.findById.mockResolvedValue({
      id: 'app-1',
      userId: 'user-1',
    });
    mockStorageService.uploadFile.mockResolvedValue({
      storagePath: '2026/08/04/abc.pdf',
      checksum: 'hash123',
      mimeType: 'application/pdf',
      fileSize: 8,
      filename: 'resume.pdf',
      storageProvider: StorageProvider.LOCAL,
    });
    mockAttachmentRepository.create.mockResolvedValue({
      id: 'att-1',
      applicationId: 'app-1',
      userId: 'user-1',
      type: AttachmentType.CV,
      label: 'My Resume',
      filename: 'resume.pdf',
      mimeType: 'application/pdf',
      fileSize: 8,
      storageProvider: StorageProvider.LOCAL,
      storagePath: '2026/08/04/abc.pdf',
      checksum: 'hash123',
    });

    const result = await service.upload(userId, dto, mockFile);

    expect(mockApplicationRepository.findById).toHaveBeenCalledWith('app-1');
    expect(mockStorageService.uploadFile).toHaveBeenCalledWith(mockFile);
    expect(result.id).toBe('att-1');
  });

  it('should throw NotFoundException if application does not belong to user during upload', async () => {
    mockApplicationRepository.findById.mockResolvedValue({
      id: 'app-1',
      userId: 'other-user',
    });

    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'resume.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: Buffer.from('data'),
      size: 4,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    await expect(
      service.upload(
        'user-1',
        { applicationId: 'app-1', type: AttachmentType.CV, label: 'CV' },
        mockFile,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should remove attachment metadata and delete physical storage file in one method', async () => {
    mockAttachmentRepository.findById.mockResolvedValue({
      id: 'att-1',
      userId: 'user-1',
      storagePath: '2026/08/04/abc.pdf',
    });

    await service.remove('att-1', 'user-1');

    expect(mockStorageService.deleteFile).toHaveBeenCalledWith(
      '2026/08/04/abc.pdf',
    );
    expect(mockAttachmentRepository.delete).toHaveBeenCalledWith('att-1');
  });
});
