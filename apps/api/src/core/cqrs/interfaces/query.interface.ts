export interface IQuery {
  queryName: string;
  correlationId?: string;
  traceId?: string;
  userId?: string;
}

export interface IQueryHandler<TQuery extends IQuery = any, TResult = any> {
  queryName: string;
  execute(query: TQuery): Promise<TResult>;
}
