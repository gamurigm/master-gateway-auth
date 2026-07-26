// Los centinelas `change-me-*` de este objeto son deliberados: este mismo archivo
// los RECHAZA cuando NODE_ENV=production, de modo que un despliegue sin secretos
// reales falla al arrancar. Son el mecanismo de defensa, no la vulnerabilidad.
const DEVELOPMENT_DEFAULTS: Record<string, string> = {
  DATABASE_URL:
    'postgresql://postgres:postgres@localhost:5442/master_gateway?schema=public',
  PORT: '3000',
  FRONTEND_ORIGIN: 'http://localhost:4200',
  JWT_ISSUER: 'master-gateway',
  JWT_AUDIENCE: 'master-gateway-clients',
  JWT_PRIVATE_KEY_PATH: './keys/private.pem',
  JWT_PUBLIC_KEY_PATH: './keys/public.pem',
  // sast-ignore: SECRET-PLACEHOLDER centinela rechazado en produccion (ver validateEnv, linea 43)
  INTERNAL_API_KEY: 'change-me-internal-key',
  INTERNAL_ALLOWED_SERVICES: 'ventas',
};

const REQUIRED_KEYS = [
  'DATABASE_URL',
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
