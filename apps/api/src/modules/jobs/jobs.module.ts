import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from './constants/jobs.constants';
import { QueueService } from './services/queue.service';
import { EmailWorker } from './workers/email.worker';
import { AttachmentWorker } from './workers/attachment.worker';
import { NotificationWorker } from './workers/notification.worker';
import { SystemWorker } from './workers/system.worker';
import { DeadLetterWorker } from './workers/dead-letter.worker';
import { AuditWorker } from './workers/audit.worker';
import { RepositoriesModule } from '../../repositories/repositories.module';

@Global()
@Module({
  imports: [
    RepositoriesModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.getOrThrow<string>('REDIS_HOST'),
          port: configService.getOrThrow<number>('REDIS_PORT'),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          db: configService.get<number>('REDIS_DB') || 0,
          tls: configService.get<boolean>('REDIS_TLS') ? {} : undefined,
          connectTimeout: 2000,
          maxRetriesPerRequest: null,
          enableOfflineQueue: false,
        },
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: {
            count: 1000,
            age: 86400,
          },
          removeOnFail: false,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.EMAIL },
      { name: QUEUE_NAMES.ATTACHMENT },
      { name: QUEUE_NAMES.NOTIFICATION },
      { name: QUEUE_NAMES.SYSTEM },
      { name: QUEUE_NAMES.DEAD_LETTER },
      { name: QUEUE_NAMES.AUDIT },
    ),
  ],
  providers: [
    QueueService,
    EmailWorker,
    AttachmentWorker,
    NotificationWorker,
    SystemWorker,
    DeadLetterWorker,
    AuditWorker,
  ],
  exports: [QueueService, BullModule],
})
export class JobsModule {}
