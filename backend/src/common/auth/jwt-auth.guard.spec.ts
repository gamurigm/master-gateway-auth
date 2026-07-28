import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync } from 'node:crypto';
import { EncryptJWT, importPKCS8, importSPKI, SignJWT } from 'jose';
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

  it('allows access and attaches claims from a validly signed access token', async () => {
    const token = await createAccessToken();
    const { context, request } = mockContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({
      sub: 'user-id',
      roleId: 'role-id',
      roleName: 'ADMIN',
      token_use: 'access',
      permissions: ['users:read'],
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

  // ─────────────────────────────────────────────────────────────────
  // Regresion del fallo critico de autenticacion.
  //
  // Los tokens se emitian como JWE cifrado con la clave PUBLICA
  // (RSA-OAEP-256), y esa clave se sirve sin proteccion en
  // /api/auth/public-key y /.well-known/jwks.json. Como en RSA-OAEP cifra la
  // clave publica, cualquiera podia fabricar un token con roleName
  // "SUPER_ADMIN" y el guard lo aceptaba: bypass total (CWE-347).
  //
  // Ahora se verifica una FIRMA hecha con la clave privada, que nunca sale del
  // Master. Estas pruebas fallarian si alguien revierte a un esquema cifrado.
  // ─────────────────────────────────────────────────────────────────
  it('rejects a token forged with only the public key (JWE)', async () => {
    const forged = await new EncryptJWT({
      sub: 'atacante',
      jti: 'forjado',
      roleId: 'role-id',
      roleName: 'SUPER_ADMIN',
      token_use: 'access',
    })
      .setProtectedHeader({ alg: 'RSA-OAEP-256', enc: 'A256GCM' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .setIssuer('master-gateway')
      .setAudience('master-gateway-clients')
      .encrypt(await importSPKI(publicKey, 'RSA-OAEP-256'));

    const { context } = mockContext(`Bearer ${forged}`);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token signed by a different key pair', async () => {
    const attacker = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const forged = await new SignJWT({
      jti: 'forjado',
      roleId: 'role-id',
      roleName: 'SUPER_ADMIN',
      token_use: 'access',
    })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setSubject('atacante')
      .setIssuedAt()
      .setExpirationTime('15m')
      .setIssuer('master-gateway')
      .setAudience('master-gateway-clients')
      .sign(await importPKCS8(attacker.privateKey, 'RS256'));

    const { context } = mockContext(`Bearer ${forged}`);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a refresh token presented as an access token', async () => {
    const refresh = await createToken('refresh');
    const { context } = mockContext(`Bearer ${refresh}`);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

async function createToken(tokenUse: 'access' | 'refresh') {
  return new SignJWT({
    jti: 'token-id',
    roleId: 'role-id',
    roleName: 'ADMIN',
    token_use: tokenUse,
    permissions: ['users:read'],
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setSubject('user-id')
    .setIssuedAt()
    .setExpirationTime('5m')
    .setIssuer('master-gateway')
    .setAudience('master-gateway-clients')
    .sign(await importPKCS8(privateKey, 'RS256'));
}

const createAccessToken = () => createToken('access');
