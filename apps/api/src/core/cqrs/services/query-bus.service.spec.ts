import { QueryBus } from './query-bus.service';
import { IQueryHandler } from '../interfaces/query.interface';

describe('QueryBus', () => {
  let queryBus: QueryBus;
  let mockMetrics: any;

  beforeEach(() => {
    mockMetrics = {
      queryExecutionTotal: { inc: jest.fn() },
    };
    queryBus = new QueryBus(mockMetrics);
  });

  it('should register and execute a query handler', async () => {
    const handler: IQueryHandler = {
      queryName: 'TestQuery',
      execute: jest.fn().mockResolvedValue({ data: 'test' }),
    };

    queryBus.registerHandler(handler);
    expect(queryBus.getRegisteredHandlers()).toContain('TestQuery');

    const result = await queryBus.execute({ queryName: 'TestQuery' });
    expect(result).toEqual({ data: 'test' });
    expect(handler.execute).toHaveBeenCalled();
    expect(mockMetrics.queryExecutionTotal.inc).toHaveBeenCalledWith({ query: 'TestQuery', status: 'success' });
  });

  it('should throw an error when executing unregistered query', async () => {
    await expect(queryBus.execute({ queryName: 'UnknownQuery' })).rejects.toThrow(
      'Query handler not found for: UnknownQuery',
    );
    expect(mockMetrics.queryExecutionTotal.inc).toHaveBeenCalledWith({ query: 'UnknownQuery', status: 'not_found' });
  });
});
