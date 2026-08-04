import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { createHmac } from 'crypto';
import { StorageProvider, ReadStreamResult, UploadFileInput } from '../interfaces/storage-provider.interface';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly uploadDir: string;
  private readonly secretKey: string;

  constructor(uploadDir?: string, secretKey = 'storage-local-secret-key') {
    this.uploadDir = uploadDir || path.join(process.cwd(), 'storage', 'uploads');
    this.secretKey = secretKey;
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async upload(file: UploadFileInput, key?: string): Promise<string> {
    const filename = (file as any).filename || (file as any).originalname || 'file';
    const storageKey = key || this.generateKey(filename);
    const fullPath = path.join(this.uploadDir, storageKey);
    const parentDir = path.dirname(fullPath);

    if (!fs.existsSync(parentDir)) {
      await fs.promises.mkdir(parentDir, { recursive: true });
    }

    if ((file as any).stream && typeof (file as any).stream.pipe === 'function') {
      const writeStream = fs.createWriteStream(fullPath);
      await new Promise<void>((resolve, reject) => {
        (file as any).stream.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    } else if (file.buffer) {
      await fs.promises.writeFile(fullPath, file.buffer);
    } else {
      throw new Error('Upload payload must contain a buffer or stream');
    }

    this.logger.log(`File saved locally: ${storageKey}`);
    return storageKey;
  }

  async download(key: string): Promise<Buffer> {
    const fullPath = path.join(this.uploadDir, key);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException(`Local file key '${key}' not found`);
    }
    return fs.promises.readFile(fullPath);
  }

  async getReadStream(key: string, start?: number, end?: number): Promise<ReadStreamResult> {
    const fullPath = path.join(this.uploadDir, key);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException(`Local file key '${key}' not found`);
    }

    const stats = await fs.promises.stat(fullPath);
    const totalLength = stats.size;

    const streamOptions: { start?: number; end?: number } = {};
    if (typeof start === 'number') streamOptions.start = start;
    if (typeof end === 'number') streamOptions.end = end;

    const stream = fs.createReadStream(fullPath, streamOptions);
    const contentLength =
      typeof start === 'number' && typeof end === 'number'
        ? end - start + 1
        : totalLength;

    return {
      stream,
      contentLength,
      totalLength,
    };
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, key);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
      this.logger.log(`File deleted locally: ${key}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = path.join(this.uploadDir, key);
    return fs.existsSync(fullPath);
  }

  async signedUrl(key: string, mode: 'GET' | 'PUT' = 'GET', expiresInSeconds = 900): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const signature = createHmac('sha256', this.secretKey)
      .update(`${mode}:${key}:${expires}`)
      .digest('hex');

    return `/api/v1/attachments/signed-access?key=${encodeURIComponent(key)}&mode=${mode}&expires=${expires}&signature=${signature}`;
  }

  public verifySignedToken(key: string, mode: 'GET' | 'PUT', expiresStr: string, signature: string): boolean {
    const expires = parseInt(expiresStr, 10);
    if (isNaN(expires) || Math.floor(Date.now() / 1000) > expires) {
      return false;
    }

    const expectedSignature = createHmac('sha256', this.secretKey)
      .update(`${mode}:${key}:${expires}`)
      .digest('hex');

    return signature === expectedSignature;
  }

  private generateKey(filename: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const ext = path.extname(filename);
    const uuid = crypto.randomUUID();
    return `${year}/${month}/${day}/${uuid}${ext}`;
  }
}
