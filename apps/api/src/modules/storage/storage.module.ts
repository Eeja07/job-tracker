import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  StorageService,
  STORAGE_PROVIDER_TOKEN,
  VIRUS_SCANNER_TOKEN,
} from './storage.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { NoOpVirusScanner } from './providers/noop-virus-scanner.provider';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER_TOKEN,
      useFactory: (configService: ConfigService) => {
        const provider = configService.get<string>('STORAGE_PROVIDER', 'LOCAL').toUpperCase();
        switch (provider) {
          case 'LOCAL':
          case 'MINIO':
          case 'S3':
          case 'R2':
          default:
            return new LocalStorageProvider();
        }
      },
      inject: [ConfigService],
    },
    {
      provide: VIRUS_SCANNER_TOKEN,
      useClass: NoOpVirusScanner,
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
