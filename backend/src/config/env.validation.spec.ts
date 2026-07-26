import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('adds development defaults', () => {
    const config = validateEnv({});

    expect(config['DATABASE_URL']).toBeDefined();
    expect(config['JWT_ISSUER']).toBe('master-gateway');
    expect(config['JWT_PRIVATE_KEY_PATH']).toBe('./keys/private.pem');
    expect(config['INTERNAL_ALLOWED_SERVICES']).toBe('');
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
        INTERNAL_ALLOWED_SERVICES: '',
        OPA_URL: 'http://opa:8181',
      }),
    ).toThrow('Unsafe default secret configured in production');
  });

  it('allows empty INTERNAL_ALLOWED_SERVICES (dynamic mode, no hardcoded services) in production', () => {
    const config = validateEnv({
      NODE_ENV: 'production',
      DATABASE_URL:
        'postgresql://postgres:postgres@localhost:5442/master_gateway?schema=public',
      INTERNAL_API_KEY: 'safe-production-internal-key-123456789',
      INTERNAL_ALLOWED_SERVICES: '',
      OPA_URL: 'http://opa:8181',
    });

    expect(config['INTERNAL_ALLOWED_SERVICES']).toBe('');
    expect(config['INTERNAL_API_KEY']).toBe(
      'safe-production-internal-key-123456789',
    );
  });

  it('allows arbitrary INTERNAL_ALLOWED_SERVICES value in dynamic or legacy mode', () => {
    const config = validateEnv({
      INTERNAL_ALLOWED_SERVICES: 'cualquier,micro,dinamico',
    });
    expect(config['INTERNAL_ALLOWED_SERVICES']).toBe(
      'cualquier,micro,dinamico',
    );
  });
});
