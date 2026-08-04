import { ICommand, ICommandHandler } from '../interfaces/command.interface';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventPublisherService } from '../../../modules/event-bus/services/event-publisher.service';
import { EventType } from '../../../modules/event-bus/enums/event-type.enum';

export interface CreateApplicationCommand extends ICommand {
  commandName: 'CreateApplication';
  userId: string;
  companyId: string;
  title: string;
  status: string;
}

export interface UpdateApplicationCommand extends ICommand {
  commandName: 'UpdateApplication';
  applicationId: string;
  userId: string;
  title?: string;
  status?: string;
}

export interface DeleteApplicationCommand extends ICommand {
  commandName: 'DeleteApplication';
  applicationId: string;
  userId: string;
}

@Injectable()
export class CreateApplicationHandler implements ICommandHandler<CreateApplicationCommand> {
  readonly commandName = 'CreateApplication';

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async execute(command: CreateApplicationCommand): Promise<any> {
    const app = await this.prisma.application.create({
      data: {
        userId: command.userId,
        companyId: command.companyId,
        jobTitle: command.title,
        status: command.status as any,
      },
    });

    await this.eventPublisher.publish({
      type: EventType.APPLICATION_CREATED,
      correlationId: command.correlationId,
      traceId: command.traceId,
      payload: {
        applicationId: app.id,
        userId: app.userId,
        companyId: app.companyId,
        title: app.jobTitle,
        status: app.status,
      },
    });

    return app;
  }
}

@Injectable()
export class UpdateApplicationHandler implements ICommandHandler<UpdateApplicationCommand> {
  readonly commandName = 'UpdateApplication';

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async execute(command: UpdateApplicationCommand): Promise<any> {
    const app = await this.prisma.application.update({
      where: { id: command.applicationId },
      data: {
        ...(command.title && { jobTitle: command.title }),
        ...(command.status && { status: command.status as any }),
      },
    });

    await this.eventPublisher.publish({
      type: EventType.APPLICATION_UPDATED,
      correlationId: command.correlationId,
      traceId: command.traceId,
      payload: {
        applicationId: app.id,
        userId: app.userId,
        changes: { title: command.title, status: command.status },
      },
    });

    return app;
  }
}

@Injectable()
export class DeleteApplicationHandler implements ICommandHandler<DeleteApplicationCommand> {
  readonly commandName = 'DeleteApplication';

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async execute(command: DeleteApplicationCommand): Promise<any> {
    const app = await this.prisma.application.delete({
      where: { id: command.applicationId },
    });

    await this.eventPublisher.publish({
      type: EventType.APPLICATION_STATUS_CHANGED,
      correlationId: command.correlationId,
      traceId: command.traceId,
      payload: {
        applicationId: command.applicationId,
        userId: command.userId,
        oldStatus: app.status,
        newStatus: 'DELETED',
      },
    });

    return { success: true };
  }
}
