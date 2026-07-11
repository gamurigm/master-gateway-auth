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

  it('rejects unsafe production defaults', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL:
          'postgresql://postgres:postgres@localhost:5442/master_gateway?schema=public',
        INTERNAL_API_KEY: 'change-me-internal-key',
        INTERNAL_ALLOWED_SERVICES: 'ventas',
      }),
    ).toThrow('Unsafe default secret configured in production');
  });
});
