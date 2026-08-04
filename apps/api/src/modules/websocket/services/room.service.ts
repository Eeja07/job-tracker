import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { AuthenticatedSocket } from '../interfaces/authenticated-socket.interface';
import { MAX_ROOM_SUBSCRIPTIONS } from '../constants/ws-rooms.constants';

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);

  /**
   * Join a socket to a room after validating authorization and subscription limits.
   */
  async joinRoom(
    server: Server,
    socket: AuthenticatedSocket,
    room: string,
  ): Promise<{ success: boolean; error?: string }> {
    const userId = socket.user.sub;

    // Enforce room subscription limit per socket
    if (socket.joinedRooms.size >= MAX_ROOM_SUBSCRIPTIONS) {
      this.logger.warn(
        JSON.stringify({
          message: 'Room join rejected: maximum subscription limit reached',
          socketId: socket.id,
          userId,
          room,
          limit: MAX_ROOM_SUBSCRIPTIONS,
        }),
      );
      return { success: false, error: 'Maximum room subscriptions reached' };
    }

    // Authorization: only allow joining your own user room
    if (room.startsWith('user:') && room !== `user:${userId}`) {
      this.logger.warn(
        JSON.stringify({
          message: 'Room join rejected: unauthorized user room',
          socketId: socket.id,
          userId,
          requestedRoom: room,
        }),
      );
      return { success: false, error: 'Not authorized to join this room' };
    }

    // Admin room requires admin role
    if (room === 'admin') {
      const roles = socket.user.roles || [];
      if (!roles.includes('ADMIN') && !roles.includes('SUPER_ADMIN')) {
        this.logger.warn(
          JSON.stringify({
            message: 'Room join rejected: admin room requires ADMIN role',
            socketId: socket.id,
            userId,
          }),
        );
        return { success: false, error: 'Admin role required' };
      }
    }

    await socket.join(room);
    socket.joinedRooms.add(room);

    this.logger.log(
      JSON.stringify({
        message: 'Socket joined room',
        socketId: socket.id,
        userId,
        room,
        totalRooms: socket.joinedRooms.size,
      }),
    );

    return { success: true };
  }

  /**
   * Remove a socket from a room.
   */
  async leaveRoom(socket: AuthenticatedSocket, room: string): Promise<void> {
    await socket.leave(room);
    socket.joinedRooms.delete(room);

    this.logger.log(
      JSON.stringify({
        message: 'Socket left room',
        socketId: socket.id,
        userId: socket.user.sub,
        room,
      }),
    );
  }

  /**
   * Clean up all room subscriptions for a socket on disconnect.
   */
  async cleanupRooms(socket: AuthenticatedSocket): Promise<void> {
    for (const room of socket.joinedRooms) {
      await socket.leave(room);
    }
    socket.joinedRooms.clear();
  }

  /**
   * Auto-join the user's personal room on connection.
   */
  async autoJoinUserRoom(socket: AuthenticatedSocket): Promise<void> {
    const userRoom = `user:${socket.user.sub}`;
    await socket.join(userRoom);
    socket.joinedRooms.add(userRoom);

    this.logger.log(
      JSON.stringify({
        message: 'Socket auto-joined user room',
        socketId: socket.id,
        userId: socket.user.sub,
        room: userRoom,
      }),
    );
  }
}
