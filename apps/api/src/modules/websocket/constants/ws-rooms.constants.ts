export enum WsRoom {
  ADMIN = 'admin',
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function companyRoom(companyId: string): string {
  return `company:${companyId}`;
}

export function applicationRoom(applicationId: string): string {
  return `application:${applicationId}`;
}

export const MAX_ROOM_SUBSCRIPTIONS = 50;
export const PRESENCE_TTL_SECONDS = 60;
export const HEARTBEAT_INTERVAL_MS = 25_000;
export const HEARTBEAT_TIMEOUT_MS = 60_000;
