import { Injectable, Inject, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import type { StorageProvider } from './interfaces/storage-provider.interface';
import type { VirusScanner } from './interfaces/virus-scanner.interface';
import { StorageProvider as StorageProviderEnum } from '@prisma/client';

export const STORAGE_PROVIDER_TOKEN = 'STORAGE_PROVIDER_TOKEN';
export const VIRUS_SCANNER_TOKEN = 'VIRUS_SCANNER_TOKEN';

export interface UploadResult {
  storagePath: string;
  checksum: string;
  mimeType: string;
  fileSize: number;
  filename: string;
  storageProvider: StorageProviderEnum;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(STORAGE_PROVIDER_TOKEN)
    private readonly provider: any,
    @Inject(VIRUS_SCANNER_TOKEN)
    private readonly virusScanner: any,
    private readonly configService: ConfigService,
  ) {}

  get activeProviderEnum(): StorageProviderEnum {
    const rawProvider = this.configService.get<string>('STORAGE_PROVIDER', 'LOCAL').toUpperCase();
    switch (rawProvider) {
      case 'MINIO':
        return StorageProviderEnum.MINIO;
      case 'S3':
        return StorageProviderEnum.S3;
      case 'R2':
        return StorageProviderEnum.R2;
      case 'LOCAL':
      default:
        return StorageProviderEnum.LOCAL;
    }
  }

  async uploadFile(file: Express.Multer.File, key?: string): Promise<UploadResult> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Invalid file upload payload');
    }

    // 1. Virus scan
    const isClean = await (this.virusScanner as VirusScanner).scan(file.buffer);
    if (!isClean) {
      throw new BadRequestException('Uploaded file failed security scan (malware detected)');
    }

    // 2. Generate SHA-256 Checksum
    const checksum = createHash('sha256').update(file.buffer).digest('hex');

    // 3. Upload physical file via provider
    const storagePath = await (this.provider as StorageProvider).upload(file, key);

    return {
      storagePath,
      checksum,
      mimeType: file.mimetype,
      fileSize: file.size,
      filename: file.originalname,
      storageProvider: this.activeProviderEnum,
    };
  }

  async downloadFile(key: string): Promise<Buffer> {
    return (this.provider as StorageProvider).download(key);
  }

  async deleteFile(key: string): Promise<void> {
    return (this.provider as StorageProvider).delete(key);
  }

  async fileExists(key: string): Promise<boolean> {
    return (this.provider as StorageProvider).exists(key);
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return (this.provider as StorageProvider).signedUrl(key, expiresInSeconds);
  }
}
