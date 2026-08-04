export interface VirusScanResult {
  isClean: boolean;
  virusName?: string;
}

export interface VirusScanner {
  /**
   * Scans a file buffer for malware or suspicious payloads.
   */
  scan(buffer: Buffer): Promise<VirusScanResult>;

  /**
   * Health probe to check if the virus scanner backend is available.
   */
  ping(): Promise<boolean>;
}
