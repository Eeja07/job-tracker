import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { StorageProvider } from '../interfaces/storage-provider.interface';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.resolve(process.cwd(), 'storage', 'uploads');
  }

  async upload(file: Express.Multer.File, key?: string): Promise<string> {
    let relativePath: string;

    if (key) {
      relativePath = key;
    } else {
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const ext = path.extname(file.originalname || '');
      const uuidFilename = `${randomUUID()}${ext}`;

      relativePath = path.join(year, month, day, uuidFilename);
    }

    const absolutePath = path.resolve(this.baseDir, relativePath);
    const directoryPath = path.dirname(absolutePath);

    await fs.promises.mkdir(directoryPath, { recursive: true });
    await fs.promises.writeFile(absolutePath, file.buffer);

    this.logger.log(`File saved locally: ${relativePath}`);
    return relativePath.replace(/\\/g, '/');
  }

  async download(key: string): Promise<Buffer> {
    const absolutePath = path.resolve(this.baseDir, key);

    try {
      return await fs.promises.readFile(absolutePath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new NotFoundException(`File not found at path: ${key}`);
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const absolutePath = path.resolve(this.baseDir, key);

    try {
      await fs.promises.unlink(absolutePath);
      this.logger.log(`File deleted locally: ${key}`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    const absolutePath = path.resolve(this.baseDir, key);

    try {
      await fs.promises.access(absolutePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async signedUrl(key: string, _expiresInSeconds = 3600): Promise<string> {
    return `/storage/uploads/${key.replace(/\\/g, '/')}`;
  }
}
