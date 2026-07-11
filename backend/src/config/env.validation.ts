const DEVELOPMENT_DEFAULTS: Record<string, string> = {
  DATABASE_URL:
    'postgresql://postgres:postgres@localhost:5442/master_gateway?schema=public',
  PORT: '3000',
  FRONTEND_ORIGIN: 'http://localhost:4200',
  JWT_ISSUER: 'master-gateway',
  JWT_AUDIENCE: 'master-gateway-clients',
  JWT_SECRET: 'change-me-access-secret',
  JWT_EXPIRES_IN: '15m',
  TEMP_JWT_SECRET: 'change-me-temp-secret',
  TEMP_JWT_EXPIRES_IN: '5m',
  REFRESH_JWT_SECRET: 'change-me-refresh-secret',
  REFRESH_JWT_EXPIRES_IN: '7d',
  INTERNAL_API_KEY: 'change-me-internal-key',
  INTERNAL_ALLOWED_SERVICES: 'ventas',
};

const REQUIRED_KEYS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'TEMP_JWT_SECRET',
  'REFRESH_JWT_SECRET',
  'INTERNAL_API_KEY',
  'INTERNAL_ALLOWED_SERVICES',
] as const;

export function validateEnv(config: Record<string, unknown>) {
  const nodeEnv =
    typeof config['NODE_ENV'] === 'string' ? config['NODE_ENV'] : 'development';
  const isProduction = nodeEnv === 'production';
  const next: Record<string, unknown> = { ...config, NODE_ENV: nodeEnv };

  for (const [key, value] of Object.entries(DEVELOPMENT_DEFAULTS)) {
    next[key] = config[key] ?? (isProduction ? undefined : value);
  }

  for (const key of REQUIRED_KEYS) {
    const value = next[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`Missing required environment variable: ${key}`);
    }

    if (isProduction && value.startsWith('change-me')) {
      throw new Error(`Unsafe default secret configured in production: ${key}`);
    }
  }

  return next;
}
