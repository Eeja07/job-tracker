import { RoomService } from './room.service';
import { AuthenticatedSocket } from '../interfaces/authenticated-socket.interface';
import { MAX_ROOM_SUBSCRIPTIONS } from '../constants/ws-rooms.constants';
import { Server } from 'socket.io';

function makeSocket(userId: string, roles: string[] = []): jest.Mocked<AuthenticatedSocket> {
  return {
    id: `socket-${Math.random().toString(36).slice(2)}`,
    user: { sub: userId, email: `${userId}@test.com`, roles },
    joinedRooms: new Set<string>(),
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
  } as unknown as jest.Mocked<AuthenticatedSocket>;
}

describe('RoomService', () => {
  let service: RoomService;
  let mockServer: jest.Mocked<Server>;

  beforeEach(() => {
    service = new RoomService();
    mockServer = {} as jest.Mocked<Server>;
  });

  it('should join a user to their own user room', async () => {
    const socket = makeSocket('user-123');
    const result = await service.joinRoom(mockServer, socket, 'user:user-123');
    expect(result.success).toBe(true);
    expect(socket.join).toHaveBeenCalledWith('user:user-123');
    expect(socket.joinedRooms.has('user:user-123')).toBe(true);
  });

  it('should reject joining another user room', async () => {
    const socket = makeSocket('user-123');
    const result = await service.joinRoom(mockServer, socket, 'user:user-999');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Not authorized');
  });

  it('should reject admin room for non-admin users', async () => {
    const socket = makeSocket('user-123', ['USER']);
    const result = await service.joinRoom(mockServer, socket, 'admin');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Admin role');
  });

  it('should allow admin room for ADMIN role users', async () => {
    const socket = makeSocket('user-123', ['ADMIN']);
    const result = await service.joinRoom(mockServer, socket, 'admin');
    expect(result.success).toBe(true);
  });

  it('should reject join when max room subscriptions exceeded', async () => {
    const socket = makeSocket('user-123');
    for (let i = 0; i < MAX_ROOM_SUBSCRIPTIONS; i++) {
      socket.joinedRooms.add(`application:app-${i}`);
    }
    const result = await service.joinRoom(mockServer, socket, 'application:app-new');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Maximum room subscriptions');
  });

  it('should leave a room successfully', async () => {
    const socket = makeSocket('user-123');
    socket.joinedRooms.add('application:app-1');
    await service.leaveRoom(socket, 'application:app-1');
    expect(socket.leave).toHaveBeenCalledWith('application:app-1');
    expect(socket.joinedRooms.has('application:app-1')).toBe(false);
  });

  it('autoJoinUserRoom should join user:userId room', async () => {
    const socket = makeSocket('user-456');
    await service.autoJoinUserRoom(socket);
    expect(socket.join).toHaveBeenCalledWith('user:user-456');
    expect(socket.joinedRooms.has('user:user-456')).toBe(true);
  });
});
