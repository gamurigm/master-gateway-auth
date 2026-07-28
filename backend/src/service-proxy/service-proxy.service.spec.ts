import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Estado } from '@prisma/client';
import { ServiceProxyService } from './service-proxy.service';
import type { RequestWithUser } from '../common/auth/request-with-user';
import type { PrismaService } from '../prisma/prisma.service';

const route = {
  id: 'route-id',
  publicPath: '/inventario/productos',
  targetPath: '/productos',
  methods: ['GET', 'POST'],
  menuId: 'menu-id',
  estado: Estado.ACTIVO,
  service: {
    id: 'service-id',
    baseUrl: 'http://127.0.0.1:3001',
    estado: Estado.ACTIVO,
  },
  menu: {
    id: 'menu-id',
    estado: Estado.ACTIVO,
    module: { estado: Estado.ACTIVO },
  },
};

function createRequest(roleName = 'SUPER_ADMIN'): RequestWithUser {
  return {
    method: 'GET',
    originalUrl: '/api/proxy/inventario/productos?estado=ACTIVO',
    url: '/api/proxy/inventario/productos?estado=ACTIVO',
    headers: { accept: 'application/json', authorization: 'Bearer token' },
    requestId: 'req-1',
    user: {
      sub: 'user-id',
      jti: 'jti',
      roleId: 'role-id',
      roleName,
      iat: 1,
      exp: 2,
      iss: 'issuer',
      aud: 'audience',
    },
  } as RequestWithUser;
}

describe('ServiceProxyService', () => {
  let prisma: {
    externalServiceRoute: { findMany: jest.Mock };
    roleMenu: { count: jest.Mock };
  };
  let fetchMock: jest.Mock;
  let service: ServiceProxyService;

  beforeEach(() => {
    process.env['ALLOW_PRIVATE_PROBE_TARGETS'] = 'true';
    prisma = {
      externalServiceRoute: { findMany: jest.fn().mockResolvedValue([route]) },
      roleMenu: { count: jest.fn().mockResolvedValue(0) },
    };
    fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      arrayBuffer: () =>
        Promise.resolve(Buffer.from(JSON.stringify({ ok: true }))),
    });
    global.fetch = fetchMock;
    service = new ServiceProxyService(
      prisma as unknown as PrismaService,
      new ConfigService(),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env['ALLOW_PRIVATE_PROBE_TARGETS'];
  });

  it('reenvia al baseUrl del servicio sin filtrar el token al micro', async () => {
    const result = await service.forward(createRequest());

    expect(result.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      'http://127.0.0.1:3001/productos?estado=ACTIVO',
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('x-gateway-user-id')).toBe('user-id');
    expect(prisma.roleMenu.count).not.toHaveBeenCalled();
  });

  it('bloquea roles normales sin item asignado antes de contactar al micro', async () => {
    await expect(service.forward(createRequest('USER'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
