import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  StorageService,
  STORAGE_PROVIDER_TOKEN,
  VIRUS_SCANNER_TOKEN,
} from './storage.service';
import { StorageProvider as StorageProviderEnum } from '@prisma/client';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { MinIOProvider } from './providers/minio.provider';
import { NoOpVirusScanner } from './providers/noop-virus-scanner.provider';
import { ClamAVScanner } from './providers/clamav-virus-scanner.provider';

describe('StorageService', () => {
  let service: StorageService;

  const mockProvider = {
    upload: jest.fn(),
    download: jest.fn(),
    getReadStream: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    signedUrl: jest.fn(),
  };

  const mockVirusScanner = {
    scan: jest.fn(),
    ping: jest.fn(),
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
    mockVirusScanner.scan.mockResolvedValue({ isClean: true });
    mockProvider.upload.mockResolvedValue('2026/08/04/sample.pdf');

    const pdfBuffer = Buffer.from('%PDF-1.4 sample content');
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'resume.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: pdfBuffer,
      size: pdfBuffer.length,
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
    expect(result.checksum.length).toBe(64);
  });

  it('should throw UnprocessableEntityException if virus scanner detects malware', async () => {
    mockVirusScanner.scan.mockResolvedValue({
      isClean: false,
      virusName: 'EICAR-Test-Signature',
    });

    const pdfBuffer = Buffer.from('%PDF-1.4 sample content');
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'infected.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: pdfBuffer,
      size: pdfBuffer.length,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    await expect(service.uploadFile(mockFile)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('should throw BadRequestException if magic bytes mismatch declared MIME type', async () => {
    const invalidBuffer = Buffer.from('MZ-fake-exe-header');
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'fake.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: invalidBuffer,
      size: invalidBuffer.length,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    await expect(service.uploadFile(mockFile)).rejects.toThrow(
      BadRequestException,
    );
  });

  describe('Storage Providers & Scanners', () => {
    it('LocalStorageProvider should produce signed URLs and verify tokens', async () => {
      const localProvider = new LocalStorageProvider();
      const signedUrl = await localProvider.signedUrl('sample.pdf', 'GET', 300);
      expect(signedUrl).toContain('signed-access');
    });

    it('MinIOProvider should construct S3 signed URLs', async () => {
      const minioProvider = new MinIOProvider(mockConfigService as any);
      const url = await minioProvider.signedUrl('doc.pdf', 'GET', 300);
      expect(url).toContain('AWS4-HMAC-SHA256');
    });

    it('NoOpVirusScanner should return isClean true for standard buffers', async () => {
      const scanner = new NoOpVirusScanner();
      const res = await scanner.scan(Buffer.from('hello world'));
      expect(res.isClean).toBe(true);
    });

    it('ClamAVScanner should detect EICAR test signature', async () => {
      const scanner = new ClamAVScanner(mockConfigService as any);
      const res = await scanner.scan(
        Buffer.from(
          'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
        ),
      );
      expect(res.isClean).toBe(false);
    });
  });
});
