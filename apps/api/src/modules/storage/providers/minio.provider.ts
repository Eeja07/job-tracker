import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { Client } from 'minio';
import {
  StorageProvider,
  ReadStreamResult,
  UploadFileInput,
} from '../interfaces/storage-provider.interface';

@Injectable()
export class MinIOProvider implements StorageProvider {
  private readonly logger = new Logger(MinIOProvider.name);
  private readonly client: Client;
  private readonly endPoint: string;
  private readonly port: number;
  private readonly useSSL: boolean;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly bucket: string;

  constructor(configService: ConfigService) {
    this.endPoint = configService.get<string>('MINIO_ENDPOINT', '127.0.0.1');
    this.port = Number(configService.get<number>('MINIO_PORT', 9000));
    this.useSSL =
      String(configService.get<boolean>('MINIO_USE_SSL', false)) === 'true';
    this.accessKey = configService.get<string>(
      'MINIO_ACCESS_KEY',
      'minioadmin',
    );
    this.secretKey = configService.get<string>(
      'MINIO_SECRET_KEY',
      'minioadmin',
    );
    this.bucket = configService.get<string>(
      'MINIO_BUCKET',
      'job-tracker-attachments',
    );

    this.client = new Client({
      endPoint: this.endPoint,
      port: this.port,
      useSSL: this.useSSL,
      accessKey: this.accessKey,
      secretKey: this.secretKey,
    });
  }

  /**
   * Helper to ensure target bucket exists before object mutation.
   */
  private async ensureBucketExists(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, '');
        this.logger.log(`Created MinIO bucket: ${this.bucket}`);
      }
    } catch (err: any) {
      this.logger.warn(`MinIO bucketExists/makeBucket error: ${err.message}`);
    }
  }

  async upload(file: UploadFileInput, key?: string): Promise<string> {
    const filename =
      (file as any).filename || (file as any).originalname || 'file';
    const storageKey = key || this.generateKey(filename);
    const mimeType = file.mimetype || 'application/octet-stream';

    await this.ensureBucketExists();

    let stream: Readable;
    let size: number | undefined = file.size;

    if (
      (file as any).stream &&
      typeof (file as any).stream.pipe === 'function'
    ) {
      stream = (file as any).stream;
    } else if (file.buffer) {
      stream = Readable.from(file.buffer);
      size = file.buffer.length;
    } else {
      throw new Error('Upload payload must contain a buffer or stream');
    }

    const metaData = {
      'content-type': mimeType,
      'x-amz-meta-original-name': filename,
    };

    try {
      await this.client.putObject(
        this.bucket,
        storageKey,
        stream,
        size,
        metaData,
      );
      this.logger.log(
        `File streamed to MinIO bucket [${this.bucket}]: ${storageKey}`,
      );
      return storageKey;
    } catch (err: any) {
      this.logger.error(
        `MinIO streaming upload failed for key [${storageKey}]: ${err.message}`,
      );
      throw err;
    }
  }

  async download(key: string): Promise<Buffer> {
    try {
      const stream = await this.client.getObject(this.bucket, key);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      return Buffer.concat(chunks);
    } catch (err: any) {
      this.logger.warn(
        `MinIO download failed for key [${key}]: ${err.message}`,
      );
      throw new NotFoundException(
        `MinIO object '${key}' not found in bucket '${this.bucket}'`,
      );
    }
  }

  async getReadStream(
    key: string,
    start?: number,
    end?: number,
  ): Promise<ReadStreamResult> {
    let stat;
    try {
      stat = await this.client.statObject(this.bucket, key);
    } catch (err: any) {
      throw new NotFoundException(
        `MinIO object '${key}' not found in bucket '${this.bucket}'`,
      );
    }

    const totalLength = stat.size;
    const mimeType =
      stat.metaData?.['content-type'] ||
      stat.metaData?.['Content-Type'] ||
      'application/octet-stream';

    let stream: Readable;
    let contentLength = totalLength;

    if (typeof start === 'number') {
      const s = start;
      const e =
        typeof end === 'number'
          ? Math.min(end, totalLength - 1)
          : totalLength - 1;
      contentLength = Math.max(0, e - s + 1);
      stream = await this.client.getPartialObject(
        this.bucket,
        key,
        s,
        contentLength,
      );
    } else {
      stream = await this.client.getObject(this.bucket, key);
    }

    return {
      stream,
      contentLength,
      totalLength,
      mimeType,
    };
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, key);
      this.logger.log(
        `Object removed from MinIO bucket [${this.bucket}]: ${key}`,
      );
    } catch (err: any) {
      this.logger.warn(`MinIO delete error for key [${key}]: ${err.message}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch {
      return false;
    }
  }

  async signedUrl(
    key: string,
    mode: 'GET' | 'PUT' = 'GET',
    expiresInSeconds = 900,
  ): Promise<string> {
    try {
      if (mode === 'PUT') {
        return await this.client.presignedPutObject(
          this.bucket,
          key,
          expiresInSeconds,
        );
      }
      return await this.client.presignedGetObject(
        this.bucket,
        key,
        expiresInSeconds,
      );
    } catch (err: any) {
      this.logger.warn(`MinIO presignedUrl failed: ${err.message}`);
      const protocol = this.useSSL ? 'https' : 'http';
      const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
      return `${protocol}://${this.endPoint}:${this.port}/${this.bucket}/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=${expiresInSeconds}`;
    }
  }

  private generateKey(filename: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const ext = filename.includes('.')
      ? filename.substring(filename.lastIndexOf('.'))
      : '';
    const uuid = crypto.randomUUID();
    return `${year}/${month}/${day}/${uuid}${ext}`;
  }
}
