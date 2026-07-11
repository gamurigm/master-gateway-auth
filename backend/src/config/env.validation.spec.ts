import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('adds development defaults', () => {
    const config = validateEnv({});

    expect(config['DATABASE_URL']).toBeDefined();
    expect(config['JWT_SECRET']).toBe('change-me-access-secret');
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
        JWT_SECRET: 'change-me-access-secret',
        TEMP_JWT_SECRET: 'temp-secret',
        REFRESH_JWT_SECRET: 'refresh-secret',
        INTERNAL_API_KEY: 'internal-key',
        INTERNAL_ALLOWED_SERVICES: 'ventas',
      }),
    ).toThrow('Unsafe default secret configured in production');
  });
});
