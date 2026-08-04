export interface StorageProvider {
  /**
   * Uploads a file to storage and returns the relative storage path/key.
   */
  upload(file: Express.Multer.File, key?: string): Promise<string>;

  /**
   * Downloads a file from storage by key/path and returns its content buffer.
   */
  download(key: string): Promise<Buffer>;

  /**
   * Deletes a file from storage by key/path.
   */
  delete(key: string): Promise<void>;

  /**
   * Checks if a file exists in storage by key/path.
   */
  exists(key: string): Promise<boolean>;

  /**
   * Generates a signed/accessible URL for the file.
   */
  signedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
