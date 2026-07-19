import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Estado } from '@prisma/client';
import { generateKeyPairSync } from 'node:crypto';
import { EncryptJWT } from 'jose';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { KeysService } from '../src/common/keys/keys.service';
import type { AuthenticatedUser } from '../src/common/auth/authenticated-user';
import { PolicyService } from '../src/common/policy/policy.service';

type HealthBody = {
  status: string;
  service?: string;
  database?: string;
  timestamp?: string;
};

process.env.JWE_SECRET = 'change-me-jwe-secret-32-bytes!!!';

const { privateKey: testPrivateKey, publicKey: testPublicKey } =
  generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

const testKeysService = {
  getPrivateKey: () => testPrivateKey,
  getPublicKey: () => testPublicKey,
} as KeysService;

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const jweSecret = 'change-me-jwe-secret-32-bytes!!!';
  const prisma = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn(),
    $transaction: jest.fn((operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
    ),
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    process.env.JWE_SECRET = jweSecret;
    jest.clearAllMocks();
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);
    prisma.refreshToken.findUnique.mockImplementation(
      ({ where }: { where: { jti: string } }) => {
        const roleName = where.jti.startsWith('superadmin')
          ? 'SUPERADMIN'
          : where.jti.startsWith('admin')
            ? 'ADMIN'
            : 'INVITADO';
        return Promise.resolve({
          userId: '11111111-1111-1111-1111-111111111111',
          roleId: '22222222-2222-2222-2222-222222222222',
          estado: Estado.ACTIVO,
          revokedAt: null,
          replacedByJti: null,
          expiresAt: new Date(Date.now() + 60_000),
          user: { estado: Estado.ACTIVO },
          role: {
            id: '22222222-2222-2222-2222-222222222222',
            name: roleName,
            estado: Estado.ACTIVO,
          },
        });
      },
    );
    const policyService = {
      assertAllowed: jest.fn(async (user: AuthenticatedUser, action: string) => {
        if (user.roleName === 'SUPERADMIN' || user.roleName === 'ADMIN') {
          return;
        }
        if (user.roleName === 'INVITADO' && action.endsWith(':read')) {
          return;
        }
        throw new ForbiddenException('Permiso no autorizado');
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(KeysService)
      .useValue(testKeysService)
      .overrideProvider(PolicyService)
      .useValue(policyService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api', {
      exclude: [{ path: '', method: RequestMethod.GET }],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect({
      status: 'ok',
      service: 'master-gateway',
      api: '/api',
      health: '/api/health',
    });
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((response) => {
        const body = response.body as HealthBody;
        expect(body).toMatchObject({
          status: 'ok',
          service: 'master-gateway',
        });
        expect(body.timestamp).toBeDefined();
      });
  });

  it('/api/health (GET) propagates request ids', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .set('x-request-id', 'req-test-1')
      .expect(200)
      .expect('x-request-id', 'req-test-1');
  });

  it('/api/health/db (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health/db')
      .expect(200)
      .expect((response) => {
        const body = response.body as HealthBody;
        expect(body).toMatchObject({
          status: 'ok',
          database: 'postgresql',
        });
        expect(body.timestamp).toBeDefined();
      });
  });

  it('/api/users (GET) requires an access token', () => {
    return request(app.getHttpServer()).get('/api/users').expect(401);
  });

  it('/api/users (GET) allows read-only guest roles', async () => {
    const token = await signAccessToken('INVITADO');

    return request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          items: [],
          total: 0,
          page: 1,
          limit: 20,
        });
      });
  });

  it('/api/users (POST) rejects read-only guest roles', async () => {
    const token = await signAccessToken('INVITADO');

    return request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'readonly@example.com',
        password: 'Readonly12345!',
        firstName: 'Readonly',
      })
      .expect(403);
  });

  it('/api/users (GET) allows admin roles', async () => {
    const token = await signAccessToken('ADMIN');

    return request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          items: [],
          total: 0,
          page: 1,
          limit: 20,
        });
      });
  });

  afterEach(async () => {
    await app.close();
  });

  const signAccessToken = (roleName: string) =>
    new EncryptJWT({
      sub: '11111111-1111-1111-1111-111111111111',
      jti: `${roleName.toLowerCase()}-jti`,
      sid: `${roleName.toLowerCase()}-session`,
    })
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
      .setIssuer('master-gateway')
      .setAudience('master-gateway-clients')
      .setIssuedAt()
      .setExpirationTime('15m')
      .encrypt(new TextEncoder().encode(jweSecret));
});
