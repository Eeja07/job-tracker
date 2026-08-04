export enum WsClientEvent {
  // Client → Server
  JOIN_ROOM = 'joinRoom',
  LEAVE_ROOM = 'leaveRoom',
  HEARTBEAT = 'heartbeat',
  PING = 'ping',
  SUBSCRIBE_APPLICATION = 'subscribeApplication',
  SUBSCRIBE_COMPANY = 'subscribeCompany',
}

export enum WsServerEvent {
  // Server → Client
  CONNECTED = 'connected',
  HEARTBEAT_ACK = 'heartbeat:ack',
  PONG = 'pong',
  ERROR = 'error',
  PRESENCE_UPDATE = 'presence:update',
  USER_ONLINE = 'user:online',
  USER_OFFLINE = 'user:offline',

  // Domain events broadcast to clients
  APPLICATION_CREATED = 'application:created',
  APPLICATION_UPDATED = 'application:updated',
  APPLICATION_STATUS_CHANGED = 'application:statusChanged',
  ATTACHMENT_UPLOADED = 'attachment:uploaded',
  ATTACHMENT_DELETED = 'attachment:deleted',
  COMPANY_CREATED = 'company:created',
  COMPANY_DELETED = 'company:deleted',
  AUDIT_CREATED = 'audit:created',
  FEATURE_FLAG_UPDATED = 'featureFlag:updated',
  ROLE_ASSIGNED = 'role:assigned',
  ROLE_REMOVED = 'role:removed',
  EMAIL_SENT = 'email:sent',
  JOB_COMPLETED = 'job:completed',
  JOB_FAILED = 'job:failed',
}
