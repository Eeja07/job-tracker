import { ICommand, ICommandHandler } from '../interfaces/command.interface';
import { Injectable } from '@nestjs/common';
import { EventPublisherService } from '../../../modules/event-bus/services/event-publisher.service';
import { EventType } from '../../../modules/event-bus/enums/event-type.enum';

export interface UploadAttachmentCommand extends ICommand {
  commandName: 'UploadAttachment';
  attachmentId: string;
  applicationId: string;
  userId: string;
  fileName: string;
  fileKey: string;
  size: number;
}

export interface DeleteAttachmentCommand extends ICommand {
  commandName: 'DeleteAttachment';
  attachmentId: string;
  applicationId: string;
  userId: string;
  fileKey: string;
}

@Injectable()
export class UploadAttachmentHandler implements ICommandHandler<UploadAttachmentCommand> {
  readonly commandName = 'UploadAttachment';

  constructor(private readonly eventPublisher: EventPublisherService) {}

  async execute(command: UploadAttachmentCommand): Promise<any> {
    await this.eventPublisher.publish({
      type: EventType.ATTACHMENT_UPLOADED,
      correlationId: command.correlationId,
      traceId: command.traceId,
      payload: {
        attachmentId: command.attachmentId,
        applicationId: command.applicationId,
        userId: command.userId,
        fileName: command.fileName,
        fileKey: command.fileKey,
        size: command.size,
      },
    });

    return { success: true };
  }
}

@Injectable()
export class DeleteAttachmentHandler implements ICommandHandler<DeleteAttachmentCommand> {
  readonly commandName = 'DeleteAttachment';

  constructor(private readonly eventPublisher: EventPublisherService) {}

  async execute(command: DeleteAttachmentCommand): Promise<any> {
    await this.eventPublisher.publish({
      type: EventType.ATTACHMENT_DELETED,
      correlationId: command.correlationId,
      traceId: command.traceId,
      payload: {
        attachmentId: command.attachmentId,
        applicationId: command.applicationId,
        userId: command.userId,
        fileKey: command.fileKey,
      },
    });

    return { success: true };
  }
}
