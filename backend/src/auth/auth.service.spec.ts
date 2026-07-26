import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Estado } from '@prisma/client';
import * as argon2 from 'argon2';
import { generateKeyPairSync } from 'node:crypto';
import type { Algorithm } from 'jsonwebtoken';
import { EncryptJWT, importPKCS8, importSPKI, jwtDecrypt } from 'jose';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const ROLE_ID = '22222222-2222-2222-2222-222222222222';
const EMAIL = 'admin@example.com';
const PASSWORD = 'Admin12345!';


const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const keysService = {
  getPrivateKey: () => privateKey,
  getPublicKey: () => publicKey,
};


const jwtOptions = {
  privateKey,
  publicKey,
  signOptions: {
    algorithm: 'RS256' as const,
    issuer: 'master-gateway',
    audience: 'master-gateway-clients',
  },
  verifyOptions: {
    algorithms: ['RS256'] as Algorithm[],
    issuer: 'master-gateway',
    audience: 'master-gateway-clients',
  },
};

type RefreshTokenCreateArgs = {
  data: { userId: string; roleId: string; createdBy: string };
};

type RefreshTokenUpdateArgs = {
  where: { id: string };
  data: { replacedByJti: string; estado: Estado };
};

type RefreshTokenUpdateManyArgs = {
  where: { userId: string; roleId: string; estado: Estado };
  data: { reuseDetected: boolean; estado: Estado };
};

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let passwordHash: string;

  const prisma = {
    user: {
      findFirst: jest.fn(),
    },
    userRole: {
      findFirst: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeAll(async () => {
    passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['INTERNAL_API_KEY'] = 'test-internal-key';
    process.env['INTERNAL_ALLOWED_SERVICES'] = 'ventas';
    jwtService = new JwtService(jwtOptions);
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService,
      new ConfigService({
        JWT_ISSUER: 'master-gateway',
        JWT_AUDIENCE: 'master-gateway-clients',
      }),
      keysService as any,
    );
    prisma.refreshToken.create.mockResolvedValue({});
    prisma.refreshToken.update.mockResolvedValue({});
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
  });

  it('login returns a temp token, active roles, and no password hash', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: USER_ID,
      email: EMAIL,
      passwordHash,
      firstName: 'Admin',
      lastName: 'Master',
      roles: [
        {
          role: {
            id: ROLE_ID,
            name: 'ADMIN',
            description: 'Administrador',
          },
        },
      ],
    });

    const result = await service.login({ email: EMAIL, password: PASSWORD });
    const tempPayload = jwtService.decode(result.tempToken);

    expect(tempPayload).toMatchObject({ sub: USER_ID, email: EMAIL });
    expect(result.roles).toEqual([
      { id: ROLE_ID, name: 'ADMIN', description: 'Administrador' },
    ]);
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('login rejects invalid credentials with a generic unauthorized error', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: USER_ID,
      email: EMAIL,
      passwordHash,
      roles: [],
    });

    await expect(
      service.login({ email: EMAIL, password: 'Wrong12345!' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('selectRole issues access and refresh tokens for an assigned role', async () => {
    const tempToken = await jwtService.signAsync(
      { sub: USER_ID, email: EMAIL },
      { expiresIn: '5m' },
    );
    prisma.userRole.findFirst.mockResolvedValue({
      role: {
        id: ROLE_ID,
        name: 'ADMIN',
      },
    });

    const result = await service.selectRole({ tempToken, roleId: ROLE_ID });
    const { payload: accessPayload } = await jwtDecrypt(
      result.accessToken,
      await importPKCS8(privateKey, 'RSA-OAEP-256'),
      {
        issuer: 'master-gateway',
        audience: 'master-gateway-clients',
      },
    );

    expect(accessPayload).toMatchObject({
      sub: USER_ID,
      roleId: ROLE_ID,
      roleName: 'ADMIN',
    });
    expect(result.role).toEqual({ id: ROLE_ID, name: 'ADMIN' });
    const createMock = prisma.refreshToken.create as jest.Mock<
      unknown,
      [RefreshTokenCreateArgs]
    >;
    const createCall = createMock.mock.calls[0]?.[0];
    expect(createCall.data).toMatchObject({
      userId: USER_ID,
      roleId: ROLE_ID,
      createdBy: USER_ID,
    });
  });

  it('selectRole rejects roles that are not assigned to the user', async () => {
    const tempToken = await jwtService.signAsync(
      { sub: USER_ID, email: EMAIL },
      { expiresIn: '5m' },
    );
    prisma.userRole.findFirst.mockResolvedValue(null);

    await expect(
      service.selectRole({ tempToken, roleId: ROLE_ID }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refresh rotates the refresh token and revokes the previous one', async () => {
    const refreshToken = await createRefreshToken('old-jti');
    const tokenHash = await argon2.hash(refreshToken, {
      type: argon2.argon2id,
    });
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'stored-token-id',
      userId: USER_ID,
      roleId: ROLE_ID,
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      replacedByJti: null,
      estado: Estado.ACTIVO,
      role: {
        name: 'ADMIN',
      },
    });

    const result = await service.refresh(refreshToken);

    expect(result.refreshToken).not.toBe(refreshToken);
    const updateMock = prisma.refreshToken.update as jest.Mock<
      unknown,
      [RefreshTokenUpdateArgs]
    >;
    const updateCall = updateMock.mock.calls[0]?.[0];
    expect(updateCall.where).toEqual({ id: 'stored-token-id' });
    expect(updateCall.data).toMatchObject({
      replacedByJti: result.refreshTokenJti,
      estado: Estado.INACTIVO,
    });
  });

  it('refresh detects reuse and revokes the active token family', async () => {
    const refreshToken = await createRefreshToken('reused-jti');
    prisma.refreshToken.findUnique.mockResolvedValue({
      userId: USER_ID,
      roleId: ROLE_ID,
      estado: Estado.ACTIVO,
      revokedAt: new Date(),
      replacedByJti: 'next-jti',
    });

    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    const updateManyMock = prisma.refreshToken.updateMany as jest.Mock<
      unknown,
      [RefreshTokenUpdateManyArgs]
    >;
    const updateManyCall = updateManyMock.mock.calls[0]?.[0];
    expect(updateManyCall.where).toEqual({
      userId: USER_ID,
      roleId: ROLE_ID,
      estado: Estado.ACTIVO,
    });
    expect(updateManyCall.data).toMatchObject({
      reuseDetected: true,
      estado: Estado.INACTIVO,
    });
  });

  it('validateInternal rejects invalid internal API keys', async () => {
    await expect(
      service.validateInternal('bad-key', 'token', 'ventas'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('validateInternal rejects every request when INTERNAL_API_KEY is missing', async () => {
    // Regresion: la comprobacion antigua era `if (expectedKey && ...)`, de modo
    // que sin INTERNAL_API_KEY configurada cualquier peticion interna pasaba.
    delete process.env['INTERNAL_API_KEY'];

    await expect(
      service.validateInternal(undefined, 'token', 'ventas'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(
      service.validateInternal('cualquier-cosa', 'token', 'ventas'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('validateInternal rejects internal services outside the allowlist', async () => {
    process.env['INTERNAL_ALLOWED_SERVICES'] = 'ventas';
    await expect(
      service.validateInternal('test-internal-key', 'token', 'reportes'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('validateInternal accepts a valid JWE for an allowed service', async () => {
    const tempToken = await jwtService.signAsync(
      { sub: USER_ID, email: EMAIL },
      { expiresIn: '5m' },
    );
    prisma.userRole.findFirst.mockResolvedValue({
      role: { id: ROLE_ID, name: 'ADMIN' },
    });
    const session = await service.selectRole({ tempToken, roleId: ROLE_ID });

    await expect(
      service.validateInternal(
        'test-internal-key',
        session.accessToken,
        'ventas',
      ),
    ).resolves.toMatchObject({
      valid: true,
      userId: USER_ID,
      roleId: ROLE_ID,
      roleName: 'ADMIN',
    });
  });

  const createRefreshToken = async (jti: string) =>
    new EncryptJWT({ sub: USER_ID, roleId: ROLE_ID, roleName: 'ADMIN', jti })
      .setProtectedHeader({ alg: 'RSA-OAEP-256', enc: 'A256GCM' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .setIssuer('master-gateway')
      .setAudience('master-gateway-clients')
      .encrypt(await importSPKI(publicKey, 'RSA-OAEP-256'));

});
