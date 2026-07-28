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
  INTERNAL_ALLOWED_SERVICES: '',
  OPA_URL: '',
};

const REQUIRED_KEYS = ['DATABASE_URL', 'INTERNAL_API_KEY'] as const;

/**
 * Claves que deben venir del entorno en produccion aunque tengan un valor por
 * defecto razonable en desarrollo. `FRONTEND_ORIGIN` estaba cayendo a
 * `http://localhost:4200` en produccion, lo que rompe CORS de forma silenciosa.
 */
const REQUIRED_IN_PRODUCTION = ['FRONTEND_ORIGIN'] as const;

/**
 * Secretos debiles que circularon por el repositorio (docker-compose, historial
 * de git). Aunque se roten, alguien puede volver a pegarlos por costumbre: el
 * arranque en produccion debe rechazarlos explicitamente.
 *
 * La comparacion es en minusculas y sin espacios.
 */
const KNOWN_WEAK_SECRETS = new Set([
  'change-me-internal-key',
  'local-docker-internal-key',
  'admin12345!',
  'superadmin12345!',
  'ci-sonar-placeholder-not-used',
]);

function assertNotWeak(key: string, value: string) {
  const normalized = value.trim().toLowerCase();

  if (
    normalized.startsWith('change-me') ||
    KNOWN_WEAK_SECRETS.has(normalized)
  ) {
    throw new Error(`Unsafe default secret configured in production: ${key}`);
  }
}

export function validateEnv(config: Record<string, unknown>) {
  const nodeEnv =
    typeof config['NODE_ENV'] === 'string' ? config['NODE_ENV'] : 'development';
  const isProduction = nodeEnv === 'production';
  const next: Record<string, unknown> = { ...config, NODE_ENV: nodeEnv };

  for (const [key, value] of Object.entries(DEVELOPMENT_DEFAULTS)) {
    next[key] = config[key] ?? (isProduction ? undefined : value);
  }

  const required = isProduction
    ? [...REQUIRED_KEYS, ...REQUIRED_IN_PRODUCTION]
    : REQUIRED_KEYS;

  for (const key of required) {
    const value = next[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`Missing required environment variable: ${key}`);
    }

    if (isProduction) {
      assertNotWeak(key, value);
    }
  }

  // Los secretos de siembra no son obligatorios (puede no ejecutarse el seed),
  // pero si estan presentes en produccion no pueden ser los valores conocidos.
  if (isProduction) {
    for (const key of ['SEED_ADMIN_PASSWORD', 'SEED_SUPER_ADMIN_PASSWORD']) {
      const value = next[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        assertNotWeak(key, value);
      }
    }
  }

  return next;
}
