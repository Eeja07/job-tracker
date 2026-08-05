export interface ICommand {
  commandName: string;
  correlationId?: string;
  traceId?: string;
  userId?: string;
}

export interface ICommandHandler<
  TCommand extends ICommand = any,
  TResult = any,
> {
  commandName: string;
  execute(command: TCommand): Promise<TResult>;
}
