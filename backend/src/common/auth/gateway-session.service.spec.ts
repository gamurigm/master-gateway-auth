import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Estado } from '@prisma/client';
import { EncryptJWT, importSPKI } from 'jose';
import { generateKeyPairSync } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { KeysService } from '../keys/keys.service';
import { GatewaySessionService } from './gateway-session.service';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const ROLE_ID = '22222222-2222-2222-2222-222222222222';
const SESSION_ID = '33333333-3333-3333-3333-333333333333';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

describe('GatewaySessionService', () => {
  let service: GatewaySessionService;

  const prisma = {
    refreshToken: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const configService = new ConfigService({
      JWT_ISSUER: 'master-gateway',
      JWT_AUDIENCE: 'master-gateway-clients',
    });
    const keysService = new KeysService(configService);
    jest.spyOn(keysService, 'getPublicKey').mockReturnValue(publicKey);
    jest.spyOn(keysService, 'getPrivateKey').mockReturnValue(privateKey);
    service = new GatewaySessionService(
      prisma as unknown as PrismaService,
      configService,
      keysService,
    );
  });

  it('resolves role context from the stored active session', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(activeSession());
    const token = await createAccessToken();

    await expect(service.resolveAccessToken(token)).resolves.toMatchObject({
      sub: USER_ID,
      sid: SESSION_ID,
      roleId: ROLE_ID,
      roleName: 'ADMIN',
    });
    expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
      where: { jti: SESSION_ID },
      include: { user: true, role: true },
    });
  });

  it('rejects a token whose session has been revoked', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      ...activeSession(),
      revokedAt: new Date(),
    });
    const token = await createAccessToken();

    await expect(service.resolveAccessToken(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects tokens without an opaque session id', async () => {
    const publicKeyObj = await importSPKI(publicKey, 'RSA-OAEP-256');
    const token = await new EncryptJWT({ sub: USER_ID, jti: 'access-jti' })
      .setProtectedHeader({ alg: 'RSA-OAEP-256', enc: 'A256GCM' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .setIssuer('master-gateway')
      .setAudience('master-gateway-clients')
      .encrypt(publicKeyObj);

    await expect(service.resolveAccessToken(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  const activeSession = () => ({
    userId: USER_ID,
    roleId: ROLE_ID,
    estado: Estado.ACTIVO,
    revokedAt: null,
    replacedByJti: null,
    expiresAt: new Date(Date.now() + 60_000),
    user: { estado: Estado.ACTIVO },
    role: { id: ROLE_ID, name: 'ADMIN', estado: Estado.ACTIVO },
  });

  const createAccessToken = async () => {
    const publicKeyObj = await importSPKI(publicKey, 'RSA-OAEP-256');
    return new EncryptJWT({ sub: USER_ID, jti: 'access-jti', sid: SESSION_ID })
      .setProtectedHeader({ alg: 'RSA-OAEP-256', enc: 'A256GCM' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .setIssuer('master-gateway')
      .setAudience('master-gateway-clients')
      .encrypt(publicKeyObj);
  };
});
