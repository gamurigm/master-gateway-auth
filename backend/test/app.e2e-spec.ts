import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { generateKeyPairSync } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { KeysService } from '../src/common/keys/keys.service';

type HealthBody = {
  status: string;
  service?: string;
  database?: string;
  timestamp?: string;
};

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
  const jwtService = new JwtService({
    privateKey: testPrivateKey,
    publicKey: testPublicKey,
    algorithms: ['RS256'],
  });
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
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(KeysService)
      .useValue(testKeysService)
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

  it('/api/users (GET) rejects non-admin roles', async () => {
    const token = await signAccessToken('USER');

    return request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
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
    jwtService.signAsync(
      {
        sub: '11111111-1111-1111-1111-111111111111',
        roleId: '22222222-2222-2222-2222-222222222222',
        roleName,
        jti: `${roleName.toLowerCase()}-jti`,
      },
      {
        algorithm: 'RS256',
        issuer: 'master-gateway',
        audience: 'master-gateway-clients',
        expiresIn: '15m',
      },
    );
});
