import { ConfigService } from '@nestjs/config';
import { PolicyService } from './policy.service';

const input = {
  subject: {
    user_id: 'u1',
    role_id: 'r1',
    role_name: 'ADMIN',
    permissions: ['users:read'],
  },
  action: 'users:read',
  resource: 'users',
};

describe('PolicyService', () => {
  const buildService = (opaUrl?: string) =>
    new PolicyService(
      new ConfigService(opaUrl === undefined ? {} : { OPA_URL: opaUrl }),
    );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports the engine as disabled when OPA_URL is not configured', async () => {
    // Clave: "disabled" NO es "allow". Antes se devolvia allow:true, lo que
    // desactivaba en silencio toda la politica en cualquier despliegue sin OPA.
    await expect(buildService().evaluate(input)).resolves.toEqual({
      engine: 'disabled',
    });
  });

  it('returns the OPA decision when the engine answers', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: { allow: true } }),
    });

    await expect(
      buildService('http://opa:8181').evaluate(input),
    ).resolves.toEqual({ engine: 'opa', allow: true });
  });

  it('denies when OPA answers with an error status (fail-closed)', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(
      buildService('http://opa:8181').evaluate(input),
    ).resolves.toEqual({ engine: 'opa', allow: false });
  });

  it('denies when OPA is unreachable (fail-closed)', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      buildService('http://opa:8181').evaluate(input),
    ).resolves.toEqual({ engine: 'opa', allow: false });
  });

  it('denies when OPA returns a payload without an explicit allow', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await expect(
      buildService('http://opa:8181').evaluate(input),
    ).resolves.toEqual({ engine: 'opa', allow: false });
  });
});
