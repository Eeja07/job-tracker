import { LocalStorageProvider } from './local-storage.provider';
import { NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

describe('LocalStorageProvider', () => {
  let provider: LocalStorageProvider;
  const testBaseDir = path.resolve(process.cwd(), 'tmp-test-storage');

  beforeEach(() => {
    provider = new LocalStorageProvider(testBaseDir);
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(testBaseDir, { recursive: true, force: true });
    } catch {}
  });

  it('should upload a file and return relative storage path with UUID and extension', async () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test_document.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: Buffer.from('dummy pdf content'),
      size: 17,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const relativePath = await provider.upload(mockFile);
    expect(relativePath).toMatch(/\.pdf$/);

    const fileExists = await provider.exists(relativePath);
    expect(fileExists).toBe(true);
  });

  it('should download uploaded file content', async () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'sample.txt',
      encoding: '7bit',
      mimetype: 'text/plain',
      buffer: Buffer.from('hello storage'),
      size: 13,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const key = await provider.upload(mockFile);
    const downloadedBuffer = await provider.download(key);
    expect(downloadedBuffer.toString()).toBe('hello storage');
  });

  it('should throw NotFoundException when downloading non-existent file', async () => {
    await expect(provider.download('invalid/path/file.txt')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should delete a file', async () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'delete_me.png',
      encoding: '7bit',
      mimetype: 'image/png',
      buffer: Buffer.from('image content'),
      size: 13,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const key = await provider.upload(mockFile);
    expect(await provider.exists(key)).toBe(true);

    await provider.delete(key);
    expect(await provider.exists(key)).toBe(false);
  });
});
