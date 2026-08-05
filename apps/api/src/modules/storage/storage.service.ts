import {
  Injectable,
  Inject,
  BadRequestException,
  UnprocessableEntityException,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { Readable } from 'stream';
import type {
  StorageProvider,
  ReadStreamResult,
} from './interfaces/storage-provider.interface';
import type { VirusScanner } from './interfaces/virus-scanner.interface';
import { FileSignatureValidator } from './validators/file-signature.validator';
import { StorageProvider as StorageProviderEnum } from '@prisma/client';
import { RedisService } from '../redis/redis.service';
import { MetricsService } from '../../core/metrics/metrics.service';

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

const DEFAULT_ALLOWED_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(STORAGE_PROVIDER_TOKEN)
    private readonly provider: StorageProvider,
    @Inject(VIRUS_SCANNER_TOKEN)
    private readonly virusScanner: VirusScanner,
    private readonly configService: ConfigService,
    @Optional() private readonly redisService?: RedisService,
    @Optional() private readonly metricsService?: MetricsService,
  ) {}

  get activeProviderEnum(): StorageProviderEnum {
    const rawProvider = this.configService
      .get<string>('STORAGE_PROVIDER', 'LOCAL')
      .toUpperCase();
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

  async uploadFile(
    file:
      | Express.Multer.File
      | {
          buffer?: Buffer;
          stream?: Readable;
          originalname?: string;
          filename?: string;
          mimetype: string;
          size?: number;
        },
    key?: string,
  ): Promise<UploadResult> {
    if (!file || (!file.buffer && !(file as any).stream)) {
      throw new BadRequestException('Invalid file upload payload');
    }

    const filename =
      (file as any).originalname || (file as any).filename || 'file';
    const mimeType = file.mimetype;
    let fileSize = file.size || 0;
    let checksum = '';

    if (file.buffer) {
      fileSize = file.buffer.length;

      // 1. File security: MIME, Extension, and Magic Bytes signature validation
      FileSignatureValidator.validate(
        file.buffer,
        filename,
        mimeType,
        DEFAULT_ALLOWED_MIMES,
      );

      // 2. Virus scan pipeline
      const startTime = Date.now();
      const scanResult = await this.virusScanner.scan(file.buffer);
      const duration = (Date.now() - startTime) / 1000;
      this.metricsService?.virusScanDurationSeconds.observe(
        { scanner: this.virusScanner.constructor.name },
        duration,
      );

      if (!scanResult.isClean) {
        this.logger.warn(
          `Security alert: Virus detected in upload '${filename}' (${scanResult.virusName})`,
        );
        this.metricsService?.storageUploadFailedTotal.inc({
          provider: this.activeProviderEnum,
          reason: 'virus_detected',
        });
        throw new UnprocessableEntityException(
          `Uploaded file failed security scan: malware detected (${scanResult.virusName || 'Infected'})`,
        );
      }

      // 3. Generate SHA-256 Checksum
      checksum = createHash('sha256').update(file.buffer).digest('hex');
    } else if ((file as any).stream) {
      checksum = createHash('sha256')
        .update(filename + Date.now())
        .digest('hex');
    }

    // 4. Upload physical file via selected provider
    try {
      const storagePath = await this.provider.upload(
        file as Express.Multer.File,
        key,
      );

      this.metricsService?.storageUploadTotal.inc({
        provider: this.activeProviderEnum,
      });
      this.metricsService?.storageBytesUploadedTotal.inc(
        { provider: this.activeProviderEnum },
        fileSize,
      );

      return {
        storagePath,
        checksum,
        mimeType,
        fileSize,
        filename,
        storageProvider: this.activeProviderEnum,
      };
    } catch (err: any) {
      this.metricsService?.storageUploadFailedTotal.inc({
        provider: this.activeProviderEnum,
        reason: 'provider_error',
      });
      throw err;
    }
  }

  async downloadFile(key: string): Promise<Buffer> {
    const buffer = await this.provider.download(key);
    this.metricsService?.storageDownloadTotal.inc({
      provider: this.activeProviderEnum,
    });
    this.metricsService?.storageBytesDownloadedTotal.inc(
      { provider: this.activeProviderEnum },
      buffer.length,
    );
    return buffer;
  }

  async getReadStream(
    key: string,
    start?: number,
    end?: number,
  ): Promise<ReadStreamResult> {
    const result = await this.provider.getReadStream(key, start, end);
    this.metricsService?.storageDownloadTotal.inc({
      provider: this.activeProviderEnum,
    });
    this.metricsService?.storageBytesDownloadedTotal.inc(
      { provider: this.activeProviderEnum },
      result.contentLength,
    );
    return result;
  }

  async deleteFile(key: string): Promise<void> {
    await this.provider.delete(key);
    // Invalidate Redis signed-url cache
    if (this.redisService) {
      await this.redisService.del(`storage:signed_url:${key}:GET`);
      await this.redisService.del(`storage:signed_url:${key}:PUT`);
    }
  }

  async fileExists(key: string): Promise<boolean> {
    return this.provider.exists(key);
  }

  async getSignedUrl(
    key: string,
    mode: 'GET' | 'PUT' = 'GET',
    expiresInSeconds = 900,
  ): Promise<string> {
    const cacheKey = `storage:signed_url:${key}:${mode}`;
    if (this.redisService) {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const url = await this.provider.signedUrl(key, mode, expiresInSeconds);

    if (this.redisService) {
      // Cache signed URL for 10 minutes (600s)
      await this.redisService.set(cacheKey, url, 600);
    }

    return url;
  }
}
