/**
 * Strict environment config loader for production readiness.
 * Validates required and optional env vars; throws on missing required in production.
 */

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const isProd = NODE_ENV === 'production';

function getEnv(key: string): string | undefined {
  return process.env[key];
}

function requireEnv(key: string, forProductionOnly = false): string {
  const value = getEnv(key);
  if (forProductionOnly && !isProd) return value ?? '';
  if (!value || value.trim() === '') {
    if (isProd) throw new Error(`Missing required env: ${key}`);
    return '';
  }
  return value.trim();
}

export const env = {
  nodeEnv: NODE_ENV,
  isProduction: isProd,

  databaseUrl: requireEnv('DATABASE_URL', true),
  sessionSecret: requireEnv('SESSION_SECRET', true),
  sessionMaxAgeSeconds: Math.max(3600, Number(getEnv('SESSION_MAX_AGE_SECONDS')) || 86400),
  csrfSecret: getEnv('CSRF_SECRET') ?? getEnv('SESSION_SECRET') ?? '',
  cookiePrefix: getEnv('COOKIE_PREFIX') ?? 'finguard',

  secretsEncryptionKey: getEnv('SECRETS_ENCRYPTION_KEY'),
  openaiApiKey: getEnv('OPENAI_API_KEY'),
  anthropicApiKey: getEnv('ANTHROPIC_API_KEY'),
  lakeraApiKey: getEnv('LAKERA_API_KEY'),
  lakeraProjectId: getEnv('LAKERA_PROJECT_ID'),

  maxRequestBodyBytes: Math.min(1024 * 1024, Math.max(4096, Number(getEnv('MAX_REQUEST_BODY_BYTES')) || 65536)),
  maxChatMessageLength: Math.min(32000, Math.max(256, Number(getEnv('MAX_CHAT_MESSAGE_LENGTH')) || 4096)),
  maxFileUploadBytes: Math.min(50 * 1024 * 1024, Math.max(0, Number(getEnv('MAX_FILE_UPLOAD_BYTES')) || 10485760)),
  rateLimitPerMinute: Math.max(5, Math.min(1000, Number(getEnv('RATE_LIMIT_REQUESTS_PER_MINUTE')) || 30)),

  uploadDir: getEnv('UPLOAD_DIR') ?? '/tmp/finguard-uploads',
  appBaseUrl: getEnv('APP_BASE_URL') ?? getEnv('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:5000',
  useDemoFinanceData: getEnv('USE_DEMO_FINANCE_DATA') === 'true',
  ragEnabled: getEnv('RAG_ENABLED') !== 'false',
};

export function assertProductionEnv(): void {
  if (!isProd) return;
  requireEnv('DATABASE_URL');
  requireEnv('SESSION_SECRET');
  if (!env.secretsEncryptionKey && (env.openaiApiKey || env.anthropicApiKey)) {
    console.warn('Production: SECRETS_ENCRYPTION_KEY not set; API keys in Admin Settings will not be stored encrypted.');
  }
}
