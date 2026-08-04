/**
 * OpenTelemetry Span Name constants.
 * Kept in a single place to ensure naming consistency.
 */
export const SPAN_NAMES = {
  HTTP_REQUEST: 'http.request',
  CONTROLLER: 'controller',
  SERVICE: 'service',
  REPOSITORY: 'repository',
  PRISMA_QUERY: 'prisma.query',
  REDIS_COMMAND: 'redis.command',
  BULLMQ_JOB: 'bullmq.job',
  EVENT_PUBLISH: 'event.publish',
  EVENT_CONSUME: 'event.consume',
  WEBSOCKET_CONNECTION: 'websocket.connection',
  WEBSOCKET_BROADCAST: 'websocket.broadcast',
  EMAIL_SEND: 'email.send',
  STORAGE_UPLOAD: 'storage.upload',
  STORAGE_DOWNLOAD: 'storage.download',
  FEATURE_FLAG_CHECK: 'featureflag.check',
  RBAC_CHECK: 'rbac.check',
  AUDIT_LOG: 'audit.log',
} as const;

/** Attributes that MUST never appear in any span — security policy. */
export const SENSITIVE_ATTRIBUTE_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'set-cookie',
  'credit_card',
  'secret',
  'private_key',
  'api_key',
]);

/** Sampling mode environment variable key. */
export const TRACING_SAMPLE_RATE_KEY = 'OTEL_SAMPLE_RATE';
export const TRACING_EXPORTER_KEY = 'OTEL_EXPORTER_TYPE'; // console | otlp | jaeger | none
export const TRACING_ENABLED_KEY = 'OTEL_TRACING_ENABLED';
export const OTEL_ENDPOINT_KEY = 'OTEL_EXPORTER_OTLP_ENDPOINT';
export const JAEGER_ENDPOINT_KEY = 'OTEL_EXPORTER_JAEGER_ENDPOINT';
export const OTEL_SERVICE_NAME = 'job-tracker-api';
