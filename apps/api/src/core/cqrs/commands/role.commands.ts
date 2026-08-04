import { ICommand, ICommandHandler } from '../interfaces/command.interface';
import { Injectable } from '@nestjs/common';
import { EventPublisherService } from '../../../modules/event-bus/services/event-publisher.service';
import { EventType } from '../../../modules/event-bus/enums/event-type.enum';

export interface AssignRoleCommand extends ICommand {
  commandName: 'AssignRole';
  userId: string;
  roleId: string;
  roleName: string;
}

export interface RemoveRoleCommand extends ICommand {
  commandName: 'RemoveRole';
  userId: string;
  roleId: string;
  roleName: string;
}

@Injectable()
export class AssignRoleHandler implements ICommandHandler<AssignRoleCommand> {
  readonly commandName = 'AssignRole';

  constructor(private readonly eventPublisher: EventPublisherService) {}

  async execute(command: AssignRoleCommand): Promise<any> {
    await this.eventPublisher.publish({
      type: EventType.ROLE_ASSIGNED,
      correlationId: command.correlationId,
      traceId: command.traceId,
      payload: {
        userId: command.userId,
        roleId: command.roleId,
        roleName: command.roleName,
      },
    });

    return { success: true };
  }
}

@Injectable()
export class RemoveRoleHandler implements ICommandHandler<RemoveRoleCommand> {
  readonly commandName = 'RemoveRole';

  constructor(private readonly eventPublisher: EventPublisherService) {}

  async execute(command: RemoveRoleCommand): Promise<any> {
    await this.eventPublisher.publish({
      type: EventType.ROLE_REMOVED,
      correlationId: command.correlationId,
      traceId: command.traceId,
      payload: {
        userId: command.userId,
        roleId: command.roleId,
        roleName: command.roleName,
      },
    });

    return { success: true };
  }
}
