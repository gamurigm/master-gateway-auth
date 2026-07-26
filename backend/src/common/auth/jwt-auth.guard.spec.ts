import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync } from 'node:crypto';
import { EncryptJWT, importSPKI } from 'jose';
import { JwtAuthGuard } from './jwt-auth.guard';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const keysService = {
  getPrivateKey: () => privateKey,
  getPublicKey: () => publicKey,
};

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  const mockContext = (authorization?: string) => {
    const request = { headers: { authorization }, user: undefined as unknown };
    return {
      request,
      context: {
        switchToHttp: () => ({ getRequest: () => request }),
      } as any,
    };
  };

  beforeEach(() => {
    guard = new JwtAuthGuard(
      new ConfigService({
        JWT_ISSUER: 'master-gateway',
        JWT_AUDIENCE: 'master-gateway-clients',
      }),
      keysService as any,
    );
  });

  it('allows access and attaches claims from a valid JWE', async () => {
    const token = await createAccessToken();
    const { context, request } = mockContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({
      sub: 'user-id',
      roleId: 'role-id',
      roleName: 'ADMIN',
    });
  });

  it.each([undefined, 'Basic token'])(
    'rejects a missing or malformed Authorization header',
    async (authorization) => {
      const { context } = mockContext(authorization);
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    },
  );

  it('rejects invalid tokens', async () => {
    const { context } = mockContext('Bearer invalid-token');
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

async function createAccessToken() {
  return new EncryptJWT({
    sub: 'user-id',
    roleId: 'role-id',
    roleName: 'ADMIN',
  })
    .setProtectedHeader({ alg: 'RSA-OAEP-256', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .setIssuer('master-gateway')
    .setAudience('master-gateway-clients')
    .encrypt(await importSPKI(publicKey, 'RSA-OAEP-256'));
}