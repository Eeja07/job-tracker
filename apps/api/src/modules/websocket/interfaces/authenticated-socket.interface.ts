import { Socket } from 'socket.io';

export interface AuthenticatedUser {
  sub: string;
  email: string;
  roles?: string[];
  iat?: number;
  exp?: number;
}

export interface AuthenticatedSocket extends Socket {
  user: AuthenticatedUser;
  correlationId: string;
  joinedRooms: Set<string>;
  lastHeartbeat: number;
  connectionTime: number;
}
