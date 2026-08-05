import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';
import { MinIOProvider } from './minio.provider';

describe('MinIOProvider', () => {
  let provider: MinIOProvider;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: any) => {
      switch (key) {
        case 'MINIO_ENDPOINT':
          return '127.0.0.1';
        case 'MINIO_PORT':
          return 9000;
        case 'MINIO_USE_SSL':
          return false;
        case 'MINIO_ACCESS_KEY':
          return 'minioadmin';
        case 'MINIO_SECRET_KEY':
          return 'minioadmin';
        case 'MINIO_BUCKET':
          return 'job-tracker-attachments';
        default:
          return defaultValue;
      }
    }),
  };

  beforeEach(() => {
    provider = new MinIOProvider(mockConfigService as any);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('Signed URLs', () => {
    it('should generate signed URL for GET operation', async () => {
      const url = await provider.signedUrl('test/path/doc.pdf', 'GET', 300);
      expect(url).toBeDefined();
      expect(typeof url).toBe('string');
      expect(url).toContain('job-tracker-attachments');
    });

    it('should generate signed URL for PUT operation', async () => {
      const url = await provider.signedUrl('test/path/upload.pdf', 'PUT', 600);
      expect(url).toBeDefined();
      expect(typeof url).toBe('string');
    });
  });

  describe('Streaming Operations Mocking', () => {
    it('should perform streaming upload using buffer payload', async () => {
      const mockClient = (provider as any).client;
      jest.spyOn(mockClient, 'bucketExists').mockResolvedValue(true as never);
      jest
        .spyOn(mockClient, 'putObject')
        .mockResolvedValue({ etag: 'mock-etag' } as never);

      const buffer = Buffer.from('PDF content stream');
      const key = await provider.upload({
        buffer,
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
      });

      expect(key).toBeDefined();
      expect(mockClient.putObject).toHaveBeenCalledWith(
        'job-tracker-attachments',
        key,
        expect.any(Readable),
        buffer.length,
        expect.objectContaining({ 'content-type': 'application/pdf' }),
      );
    });

    it('should perform streaming upload using Readable stream payload', async () => {
      const mockClient = (provider as any).client;
      jest.spyOn(mockClient, 'bucketExists').mockResolvedValue(true as never);
      jest
        .spyOn(mockClient, 'putObject')
        .mockResolvedValue({ etag: 'mock-etag' } as never);

      const stream = Readable.from(['chunk 1', 'chunk 2']);
      const key = await provider.upload({
        stream,
        filename: 'stream.pdf',
        mimetype: 'application/pdf',
        size: 14,
      });

      expect(key).toBeDefined();
      expect(mockClient.putObject).toHaveBeenCalledWith(
        'job-tracker-attachments',
        key,
        stream,
        14,
        expect.objectContaining({ 'content-type': 'application/pdf' }),
      );
    });

    it('should stream download file into Buffer', async () => {
      const mockClient = (provider as any).client;
      const dataStream = Readable.from([
        Buffer.from('hello '),
        Buffer.from('world'),
      ]);
      jest
        .spyOn(mockClient, 'getObject')
        .mockResolvedValue(dataStream as never);

      const downloaded = await provider.download('test.txt');
      expect(downloaded.toString()).toBe('hello world');
    });

    it('should return read stream result with range for partial streaming download', async () => {
      const mockClient = (provider as any).client;
      jest.spyOn(mockClient, 'statObject').mockResolvedValue({
        size: 100,
        metaData: { 'content-type': 'application/pdf' },
      } as never);

      const mockPartialStream = Readable.from([Buffer.from('partial')]);
      jest
        .spyOn(mockClient, 'getPartialObject')
        .mockResolvedValue(mockPartialStream as never);

      const result = await provider.getReadStream('doc.pdf', 10, 20);

      expect(result.contentLength).toBe(11);
      expect(result.totalLength).toBe(100);
      expect(result.mimeType).toBe('application/pdf');
      expect(mockClient.getPartialObject).toHaveBeenCalledWith(
        'job-tracker-attachments',
        'doc.pdf',
        10,
        11,
      );
    });

    it('should check file existence via statObject', async () => {
      const mockClient = (provider as any).client;
      jest
        .spyOn(mockClient, 'statObject')
        .mockResolvedValue({ size: 50 } as never);

      const exists = await provider.exists('valid.key');
      expect(exists).toBe(true);

      jest
        .spyOn(mockClient, 'statObject')
        .mockRejectedValue(new Error('Object not found') as never);
      const notExists = await provider.exists('invalid.key');
      expect(notExists).toBe(false);
    });

    it('should delete file via removeObject', async () => {
      const mockClient = (provider as any).client;
      jest
        .spyOn(mockClient, 'removeObject')
        .mockResolvedValue(undefined as never);

      await provider.delete('to-delete.pdf');
      expect(mockClient.removeObject).toHaveBeenCalledWith(
        'job-tracker-attachments',
        'to-delete.pdf',
      );
    });
  });
});
