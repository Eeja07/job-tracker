import { Test, TestingModule } from '@nestjs/testing';
import { AttachmentsController } from './attachments.controller';
import { AttachmentService } from './attachment.service';
import { StorageService } from '../storage/storage.service';
import { AttachmentType, StorageProvider } from '@prisma/client';

describe('AttachmentsController', () => {
  let controller: AttachmentsController;

  const mockAttachmentService = {
    upload: jest.fn(),
    findByApplication: jest.fn(),
    findOne: jest.fn(),
    download: jest.fn(),
    getReadStream: jest.fn(),
    getSignedUrl: jest.fn(),
    remove: jest.fn(),
  };

  const mockStorageService = {
    getReadStream: jest.fn(),
    getSignedUrl: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttachmentsController],
      providers: [
        { provide: AttachmentService, useValue: mockAttachmentService },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    controller = module.get<AttachmentsController>(AttachmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate upload request to AttachmentService', async () => {
    const req = { user: { sub: 'user-1' } };
    const dto = { applicationId: 'app-1', type: AttachmentType.CV, label: 'Resume' };
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'cv.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 sample'),
      size: 15,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    mockAttachmentService.upload.mockResolvedValue({
      id: 'att-1',
      applicationId: 'app-1',
      userId: 'user-1',
      type: AttachmentType.CV,
      label: 'Resume',
      storageProvider: StorageProvider.LOCAL,
      storagePath: 'path/cv.pdf',
    });

    const result = await controller.upload(req, dto, mockFile);
    expect(mockAttachmentService.upload).toHaveBeenCalledWith('user-1', dto, mockFile);
    expect(result.id).toBe('att-1');
  });
});
