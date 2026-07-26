const DEVELOPMENT_DEFAULTS: Record<string, string> = {
  DATABASE_URL:
    'postgresql://postgres:postgres@localhost:5442/master_gateway?schema=public',
  PORT: '3000',
  FRONTEND_ORIGIN: 'http://localhost:4200',
  JWT_ISSUER: 'master-gateway',
  JWT_AUDIENCE: 'master-gateway-clients',
  JWT_PRIVATE_KEY_PATH: './keys/private.pem',
  JWT_PUBLIC_KEY_PATH: './keys/public.pem',
  INTERNAL_API_KEY: 'change-me-internal-key',
  INTERNAL_ALLOWED_SERVICES: '',
  OPA_URL: 'http://localhost:8181',
};

const PRODUCTION_SAFE_DEFAULTS: Record<string, string> = {
  PORT: '3000',
  JWT_ISSUER: 'master-gateway',
  JWT_AUDIENCE: 'master-gateway-clients',
  JWT_PRIVATE_KEY_PATH: './keys/private.pem',
  JWT_PUBLIC_KEY_PATH: './keys/public.pem',
  INTERNAL_ALLOWED_SERVICES: '',
  FRONTEND_ORIGIN: 'http://localhost:4200',
};

const REQUIRED_KEYS = ['DATABASE_URL', 'INTERNAL_API_KEY', 'OPA_URL'] as const;

const CHANGE_ME_UNSAFE_KEYS = ['INTERNAL_API_KEY', 'DATABASE_URL'] as const;

export function validateEnv(config: Record<string, unknown>) {
  const nodeEnv =
    typeof config['NODE_ENV'] === 'string' ? config['NODE_ENV'] : 'development';
  const isProduction = nodeEnv === 'production';
  const next: Record<string, unknown> = { ...config, NODE_ENV: nodeEnv };

  const defaults = isProduction
    ? PRODUCTION_SAFE_DEFAULTS
    : DEVELOPMENT_DEFAULTS;
  for (const [key, value] of Object.entries(defaults)) {
    const incoming = next[key];
    if (incoming === undefined || incoming === null || incoming === '') {
      next[key] = value;
    }
  }

  for (const key of REQUIRED_KEYS) {
    const value = next[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  if (isProduction) {
    for (const key of CHANGE_ME_UNSAFE_KEYS) {
      const value = next[key];
      if (typeof value === 'string' && value.startsWith('change-me')) {
        throw new Error(
          `Unsafe default secret configured in production: ${key}`,
        );
      }
    }
  }

  return next;
}
