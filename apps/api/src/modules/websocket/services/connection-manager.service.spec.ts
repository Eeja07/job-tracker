import { ConnectionManager } from './connection-manager.service';
import { AuthenticatedSocket } from '../interfaces/authenticated-socket.interface';

function makeSocket(userId: string, socketId: string): AuthenticatedSocket {
  return {
    id: socketId,
    user: { sub: userId, email: `${userId}@test.com` },
    joinedRooms: new Set<string>(),
  } as unknown as AuthenticatedSocket;
}

describe('ConnectionManager', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    manager = new ConnectionManager();
  });

  it('should register a socket connection', () => {
    const socket = makeSocket('user-1', 'socket-1');
    manager.register(socket);
    expect(manager.getConnectionCount()).toBe(1);
    expect(manager.isUserConnected('user-1')).toBe(true);
  });

  it('should support multiple tabs (same user, different sockets)', () => {
    const socket1 = makeSocket('user-1', 'socket-1');
    const socket2 = makeSocket('user-1', 'socket-2');
    manager.register(socket1);
    manager.register(socket2);
    expect(manager.getConnectionCount()).toBe(2);
    expect(manager.getUserSocketIds('user-1')).toHaveLength(2);
  });

  it('should unregister a socket and clean up user mapping', () => {
    const socket = makeSocket('user-1', 'socket-1');
    manager.register(socket);
    const record = manager.unregister('socket-1');
    expect(record?.userId).toBe('user-1');
    expect(manager.getConnectionCount()).toBe(0);
    expect(manager.isUserConnected('user-1')).toBe(false);
  });

  it('should not remove user when other tabs remain', () => {
    const socket1 = makeSocket('user-1', 'socket-1');
    const socket2 = makeSocket('user-1', 'socket-2');
    manager.register(socket1);
    manager.register(socket2);
    manager.unregister('socket-1');
    expect(manager.isUserConnected('user-1')).toBe(true);
    expect(manager.getUserSocketIds('user-1')).toEqual(['socket-2']);
  });

  it('should return empty list for unknown user', () => {
    expect(manager.getUserSocketIds('unknown-user')).toEqual([]);
  });

  it('getStaleSocketIds should identify connections past timeout', () => {
    const socket = makeSocket('user-1', 'socket-1');
    manager.register(socket);

    // Force lastActivity to the past
    const record = (manager as any).connections.get('socket-1');
    if (record) {
      record.lastActivity = Date.now() - 120_000;
    }

    const stale = manager.getStaleSocketIds(60_000);
    expect(stale).toContain('socket-1');
  });

  it('getOnlineUserIds should return all connected users', () => {
    manager.register(makeSocket('user-1', 'socket-1'));
    manager.register(makeSocket('user-2', 'socket-2'));
    const ids = manager.getOnlineUserIds();
    expect(ids).toContain('user-1');
    expect(ids).toContain('user-2');
  });
});
