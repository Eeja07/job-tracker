import { Injectable, Logger } from '@nestjs/common';
import { VirusScanner, VirusScanResult } from '../interfaces/virus-scanner.interface';

@Injectable()
export class NoOpVirusScanner implements VirusScanner {
  private readonly logger = new Logger(NoOpVirusScanner.name);

  async scan(buffer: Buffer): Promise<VirusScanResult> {
    // EICAR test string detection even in NoOp for security testing validation
    const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 128));
    if (content.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) {
      this.logger.warn('EICAR antivirus test signature detected by NoOpScanner!');
      return { isClean: false, virusName: 'EICAR-Test-Signature' };
    }

    return { isClean: true };
  }

  async ping(): Promise<boolean> {
    return true;
  }
}
