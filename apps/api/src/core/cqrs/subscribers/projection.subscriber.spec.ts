import { ProjectionSubscriber } from './projection.subscriber';
import { EventType } from '../../../modules/event-bus/enums/event-type.enum';

describe('ProjectionSubscriber', () => {
  let subscriber: ProjectionSubscriber;
  let mockProjectionManager: any;
  let mockSubscriberService: any;

  beforeEach(() => {
    mockProjectionManager = {
      processEvent: jest.fn(),
    };
    mockSubscriberService = {
      registerSubscriber: jest.fn(),
    };

    subscriber = new ProjectionSubscriber(
      mockProjectionManager,
      mockSubscriberService,
    );
  });

  it('should register subscriber onInit', () => {
    subscriber.onModuleInit();
    expect(mockSubscriberService.registerSubscriber).toHaveBeenCalledWith(
      subscriber,
    );
  });

  it('should route event to ProjectionManager handle', async () => {
    const event = {
      eventId: 'evt-999',
      type: EventType.APPLICATION_CREATED,
      timestamp: new Date().toISOString(),
      payload: {},
    };

    await subscriber.handle(event as any);
    expect(mockProjectionManager.processEvent).toHaveBeenCalledWith(event);
  });
});
