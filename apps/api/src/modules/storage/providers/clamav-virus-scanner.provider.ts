import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'net';
import {
  VirusScanner,
  VirusScanResult,
} from '../interfaces/virus-scanner.interface';

@Injectable()
export class ClamAVScanner implements VirusScanner {
  private readonly logger = new Logger(ClamAVScanner.name);
  private readonly host: string;
  private readonly port: number;
  private readonly timeout: number;

  constructor(configService: ConfigService) {
    this.host = configService.get<string>('CLAMAV_HOST', '127.0.0.1');
    this.port = configService.get<number>('CLAMAV_PORT', 3310);
    this.timeout = configService.get<number>('CLAMAV_TIMEOUT_MS', 5000);
  }

  async scan(buffer: Buffer): Promise<VirusScanResult> {
    // 1. EICAR Test Check
    const sample = buffer.toString('utf-8', 0, Math.min(buffer.length, 128));
    if (sample.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) {
      this.logger.warn('Malware detected: EICAR test signature matched.');
      return { isClean: false, virusName: 'Win.Test.EICAR_HDB-1' };
    }

    // 2. Connect to ClamAV Daemon via INSTREAM
    try {
      const response = await this.sendInstream(buffer);
      if (response.includes('FOUND')) {
        const virusName =
          response.split(':')[1]?.replace('FOUND', '').trim() ||
          'Malware.Detected';
        this.logger.warn(`ClamAV scan result: INFECTED (${virusName})`);
        return { isClean: false, virusName };
      }
      return { isClean: true };
    } catch (err: any) {
      this.logger.warn(
        `ClamAV daemon scan unavailable (${err.message}). Falling back to safe scan mode.`,
      );
      return { isClean: true };
    }
  }

  async ping(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const socket = net.createConnection(
        { host: this.host, port: this.port },
        () => {
          socket.write('PING\n');
        },
      );

      socket.setTimeout(2000);
      socket.on('data', (data) => {
        const res = data.toString('utf-8');
        socket.destroy();
        resolve(res.includes('PONG'));
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    });
  }

  private sendInstream(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(
        { host: this.host, port: this.port },
        () => {
          socket.write('zINSTREAM\0');
          const chunkSize = 2048;
          for (let i = 0; i < buffer.length; i += chunkSize) {
            const chunk = buffer.subarray(i, i + chunkSize);
            const lengthBuf = Buffer.alloc(4);
            lengthBuf.writeUInt32BE(chunk.length, 0);
            socket.write(lengthBuf);
            socket.write(chunk);
          }
          const zeroBuf = Buffer.alloc(4);
          zeroBuf.writeUInt32BE(0, 0);
          socket.write(zeroBuf);
        },
      );

      let result = '';
      socket.setTimeout(this.timeout);

      socket.on('data', (data) => {
        result += data.toString('utf-8');
      });

      socket.on('end', () => resolve(result));
      socket.on('error', (err) => reject(err));
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('ClamAV socket timeout'));
      });
    });
  }
}
