import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  StorageService,
  STORAGE_PROVIDER_TOKEN,
  VIRUS_SCANNER_TOKEN,
} from './storage.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { MinIOProvider } from './providers/minio.provider';
import { NoOpVirusScanner } from './providers/noop-virus-scanner.provider';
import { ClamAVScanner } from './providers/clamav-virus-scanner.provider';
import { RedisModule } from '../redis/redis.module';
import { MetricsModule } from '../../core/metrics/metrics.module';

@Global()
@Module({
  imports: [RedisModule, MetricsModule],
  providers: [
    {
      provide: STORAGE_PROVIDER_TOKEN,
      useFactory: (configService: ConfigService) => {
        const provider = configService
          .get<string>('STORAGE_PROVIDER', 'LOCAL')
          .toUpperCase();
        switch (provider) {
          case 'MINIO':
          case 'S3':
            return new MinIOProvider(configService);
          case 'LOCAL':
          default:
            return new LocalStorageProvider();
        }
      },
      inject: [ConfigService],
    },
    {
      provide: VIRUS_SCANNER_TOKEN,
      useFactory: (configService: ConfigService) => {
        const scanner = configService
          .get<string>('VIRUS_SCANNER_PROVIDER', 'NOOP')
          .toUpperCase();
        switch (scanner) {
          case 'CLAMAV':
            return new ClamAVScanner(configService);
          case 'NOOP':
          default:
            return new NoOpVirusScanner();
        }
      },
      inject: [ConfigService],
    },
    StorageService,
  ],
  exports: [StorageService, STORAGE_PROVIDER_TOKEN, VIRUS_SCANNER_TOKEN],
})
export class StorageModule {}
