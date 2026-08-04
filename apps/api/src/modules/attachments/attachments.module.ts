import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../repositories/repositories.module';
import { AttachmentsController } from './attachments.controller';
import { AttachmentService } from './attachment.service';

@Module({
  imports: [RepositoriesModule],
  controllers: [AttachmentsController],
  providers: [AttachmentService],
  exports: [AttachmentService],
})
export class AttachmentsModule {}
