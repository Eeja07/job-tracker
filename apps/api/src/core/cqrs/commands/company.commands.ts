import { ICommand, ICommandHandler } from '../interfaces/command.interface';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventPublisherService } from '../../../modules/event-bus/services/event-publisher.service';
import { EventType } from '../../../modules/event-bus/enums/event-type.enum';

export interface CreateCompanyCommand extends ICommand {
  commandName: 'CreateCompany';
  name: string;
  website?: string;
}

export interface UpdateCompanyCommand extends ICommand {
  commandName: 'UpdateCompany';
  companyId: string;
  name?: string;
  website?: string;
}

export interface DeleteCompanyCommand extends ICommand {
  commandName: 'DeleteCompany';
  companyId: string;
}

@Injectable()
export class CreateCompanyHandler implements ICommandHandler<CreateCompanyCommand> {
  readonly commandName = 'CreateCompany';

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async execute(command: CreateCompanyCommand): Promise<any> {
    const company = await this.prisma.company.create({
      data: {
        name: command.name,
        website: command.website,
      },
    });

    await this.eventPublisher.publish({
      type: EventType.COMPANY_CREATED,
      correlationId: command.correlationId,
      traceId: command.traceId,
      payload: {
        companyId: company.id,
        name: company.name,
        website: company.website || undefined,
      },
    });

    return company;
  }
}

@Injectable()
export class UpdateCompanyHandler implements ICommandHandler<UpdateCompanyCommand> {
  readonly commandName = 'UpdateCompany';

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: UpdateCompanyCommand): Promise<any> {
    return await this.prisma.company.update({
      where: { id: command.companyId },
      data: {
        ...(command.name && { name: command.name }),
        ...(command.website !== undefined && { website: command.website }),
      },
    });
  }
}

@Injectable()
export class DeleteCompanyHandler implements ICommandHandler<DeleteCompanyCommand> {
  readonly commandName = 'DeleteCompany';

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async execute(command: DeleteCompanyCommand): Promise<any> {
    const company = await this.prisma.company.delete({
      where: { id: command.companyId },
    });

    await this.eventPublisher.publish({
      type: EventType.COMPANY_DELETED,
      correlationId: command.correlationId,
      traceId: command.traceId,
      payload: {
        companyId: company.id,
        name: company.name,
      },
    });

    return { success: true };
  }
}
