export interface VirusScanner {
  /**
   * Scans a file buffer for malware or suspicious payloads.
   * Returns true if safe, false if infected.
   */
  scan(buffer: Buffer): Promise<boolean>;
}
