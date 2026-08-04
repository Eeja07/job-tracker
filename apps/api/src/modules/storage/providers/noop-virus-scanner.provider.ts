import { Injectable, Logger } from '@nestjs/common';
import { VirusScanner } from '../interfaces/virus-scanner.interface';

@Injectable()
export class NoOpVirusScanner implements VirusScanner {
  private readonly logger = new Logger(NoOpVirusScanner.name);

  async scan(_buffer: Buffer): Promise<boolean> {
    this.logger.debug('NoOpVirusScanner: File scan skipped (clean)');
    return true;
  }
}
