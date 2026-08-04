import { Readable } from 'stream';

export type UploadFileInput =
  | Express.Multer.File
  | {
      buffer?: Buffer;
      stream?: Readable;
      filename?: string;
      originalname?: string;
      mimetype?: string;
      size?: number;
    };

export interface ReadStreamResult {
  stream: Readable;
  contentLength: number;
  totalLength: number;
  mimeType?: string;
}

export interface StorageProvider {
  /**
   * Uploads a file to storage and returns the storage key.
   */
  upload(file: UploadFileInput, key?: string): Promise<string>;

  /**
   * Downloads a file from storage by key/path and returns its content buffer.
   */
  download(key: string): Promise<Buffer>;

  /**
   * Obtains a readable stream for a file, supporting optional byte-range streaming.
   */
  getReadStream(key: string, start?: number, end?: number): Promise<ReadStreamResult>;

  /**
   * Deletes a file from storage by key.
   */
  delete(key: string): Promise<void>;

  /**
   * Checks if a file exists in storage by key.
   */
  exists(key: string): Promise<boolean>;

  /**
   * Generates a signed/accessible URL for GET or PUT operations.
   */
  signedUrl(key: string, mode?: 'GET' | 'PUT', expiresInSeconds?: number): Promise<string>;
}
