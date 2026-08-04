import { Injectable, Logger } from '@nestjs/common';
import { ICommand, ICommandHandler } from '../interfaces/command.interface';
import { CqrsMetricsService } from './cqrs-metrics.service';
import { TraceContextService } from '../../tracing/services/trace-context.service';

@Injectable()
export class CommandBus {
  private readonly logger = new Logger(CommandBus.name);
  private readonly handlers = new Map<string, ICommandHandler>();

  constructor(
    private readonly metricsService: CqrsMetricsService,
    private readonly traceContextService?: TraceContextService,
  ) {}

  registerHandler(handler: ICommandHandler): void {
    this.handlers.set(handler.commandName, handler);
    this.logger.log(`Registered command handler: ${handler.commandName}`);
  }

  async execute<TCommand extends ICommand = any, TResult = any>(command: TCommand): Promise<TResult> {
    const commandName = command.commandName;
    const handler = this.handlers.get(commandName);

    const traceId = command.traceId || this.traceContextService?.getTraceId() || 'unknown';
    const correlationId = command.correlationId || this.traceContextService?.getCorrelationId() || 'unknown';

    if (!handler) {
      this.logger.error(
        JSON.stringify({
          message: `Command handler not found for: ${commandName}`,
          commandName,
          traceId,
          correlationId,
        }),
      );
      this.metricsService.commandExecutionTotal.inc({ command: commandName, status: 'not_found' });
      throw new Error(`Command handler not found for: ${commandName}`);
    }

    const startTime = Date.now();

    this.logger.log(
      JSON.stringify({
        message: 'Executing command',
        commandName,
        traceId,
        correlationId,
        userId: command.userId,
      }),
    );

    try {
      const result = await handler.execute(command);
      this.metricsService.commandExecutionTotal.inc({ command: commandName, status: 'success' });
      return result;
    } catch (err: any) {
      this.logger.error(
        JSON.stringify({
          message: 'Command execution failed',
          commandName,
          traceId,
          correlationId,
          error: err.message,
          durationMs: Date.now() - startTime,
        }),
      );
      this.metricsService.commandExecutionTotal.inc({ command: commandName, status: 'failure' });
      throw err;
    }
  }

  getRegisteredHandlers(): string[] {
    return Array.from(this.handlers.keys());
  }
}
