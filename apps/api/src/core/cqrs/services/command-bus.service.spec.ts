import { CommandBus } from './command-bus.service';
import { ICommandHandler } from '../interfaces/command.interface';

describe('CommandBus', () => {
  let commandBus: CommandBus;
  let mockMetrics: any;

  beforeEach(() => {
    mockMetrics = {
      commandExecutionTotal: { inc: jest.fn() },
    };
    commandBus = new CommandBus(mockMetrics);
  });

  it('should register and execute a command handler', async () => {
    const handler: ICommandHandler = {
      commandName: 'TestCommand',
      execute: jest.fn().mockResolvedValue({ success: true }),
    };

    commandBus.registerHandler(handler);
    expect(commandBus.getRegisteredHandlers()).toContain('TestCommand');

    const result = await commandBus.execute({ commandName: 'TestCommand' });
    expect(result).toEqual({ success: true });
    expect(handler.execute).toHaveBeenCalled();
    expect(mockMetrics.commandExecutionTotal.inc).toHaveBeenCalledWith({ command: 'TestCommand', status: 'success' });
  });

  it('should throw an error when executing unregistered command', async () => {
    await expect(commandBus.execute({ commandName: 'UnknownCommand' })).rejects.toThrow(
      'Command handler not found for: UnknownCommand',
    );
    expect(mockMetrics.commandExecutionTotal.inc).toHaveBeenCalledWith({ command: 'UnknownCommand', status: 'not_found' });
  });
});
