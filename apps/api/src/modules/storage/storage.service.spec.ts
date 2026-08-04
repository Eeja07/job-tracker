import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { StorageService, STORAGE_PROVIDER_TOKEN, VIRUS_SCANNER_TOKEN } from './storage.service';
import { StorageProvider as StorageProviderEnum } from '@prisma/client';

describe('StorageService', () => {
  let service: StorageService;

  const mockProvider = {
    upload: jest.fn(),
    download: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    signedUrl: jest.fn(),
  };

  const mockVirusScanner = {
    scan: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('LOCAL'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: STORAGE_PROVIDER_TOKEN, useValue: mockProvider },
        { provide: VIRUS_SCANNER_TOKEN, useValue: mockVirusScanner },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate SHA256 checksum and upload file when clean', async () => {
    mockVirusScanner.scan.mockResolvedValue(true);
    mockProvider.upload.mockResolvedValue('2026/08/04/sample.pdf');

    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'resume.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: Buffer.from('test data'),
      size: 9,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const result = await service.uploadFile(mockFile);

    expect(mockVirusScanner.scan).toHaveBeenCalledWith(mockFile.buffer);
    expect(mockProvider.upload).toHaveBeenCalledWith(mockFile, undefined);
    expect(result.storagePath).toBe('2026/08/04/sample.pdf');
    expect(result.filename).toBe('resume.pdf');
    expect(result.storageProvider).toBe(StorageProviderEnum.LOCAL);
    expect(result.checksum).toBeDefined();
    expect(result.checksum.length).toBe(64); // SHA-256 hex length
  });

  it('should throw BadRequestException if virus scanner detects malware', async () => {
    mockVirusScanner.scan.mockResolvedValue(false);

    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'virus.exe',
      encoding: '7bit',
      mimetype: 'application/x-msdownload',
      buffer: Buffer.from('infected payload'),
      size: 16,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    await expect(service.uploadFile(mockFile)).rejects.toThrow(BadRequestException);
  });
});
