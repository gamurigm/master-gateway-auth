import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('adds development defaults', () => {
    const config = validateEnv({});

    expect(config['DATABASE_URL']).toBeDefined();
    expect(config['JWT_ISSUER']).toBe('master-gateway');
    expect(config['JWT_PRIVATE_KEY_PATH']).toBe('./keys/private.pem');
  });

  it('rejects missing production secrets', () => {
    expect(() => validateEnv({ NODE_ENV: 'production' })).toThrow(
      'Missing required environment variable',
    );
  });

  const productionBase = {
    NODE_ENV: 'production',
    DATABASE_URL:
      'postgresql://postgres:postgres@localhost:5442/master_gateway?schema=public',
    INTERNAL_ALLOWED_SERVICES: 'ventas',
    FRONTEND_ORIGIN: 'https://app.example.com',
  };

  it('rejects unsafe production defaults', () => {
    expect(() =>
      validateEnv({
        ...productionBase,
        INTERNAL_API_KEY: 'change-me-internal-key',
      }),
    ).toThrow('Unsafe default secret configured in production');
  });

  // Estos literales circularon en docker-compose y en el historial de git.
  it.each(['local-docker-internal-key', 'LOCAL-DOCKER-INTERNAL-KEY  '])(
    'rejects the leaked docker-compose key %p',
    (leaked) => {
      expect(() =>
        validateEnv({ ...productionBase, INTERNAL_API_KEY: leaked }),
      ).toThrow('Unsafe default secret configured in production');
    },
  );

  it('rejects the leaked seed passwords in production', () => {
    expect(() =>
      validateEnv({
        ...productionBase,
        INTERNAL_API_KEY: 'una-clave-interna-fuerte',
        SEED_ADMIN_PASSWORD: 'Admin12345!',
      }),
    ).toThrow('Unsafe default secret configured in production');
  });

  it('requires FRONTEND_ORIGIN in production instead of falling back to localhost', () => {
    const withoutOrigin: Record<string, unknown> = { ...productionBase };
    delete withoutOrigin['FRONTEND_ORIGIN'];

    expect(() =>
      validateEnv({
        ...withoutOrigin,
        INTERNAL_API_KEY: 'una-clave-interna-fuerte',
      }),
    ).toThrow('Missing required environment variable: FRONTEND_ORIGIN');
  });

  it('accepts a well configured production environment', () => {
    const config = validateEnv({
      ...productionBase,
      INTERNAL_API_KEY: 'una-clave-interna-fuerte',
      SEED_ADMIN_PASSWORD: 'otra-password-fuerte-y-distinta',
    });

    expect(config['NODE_ENV']).toBe('production');
    expect(config['FRONTEND_ORIGIN']).toBe('https://app.example.com');
  });
});
