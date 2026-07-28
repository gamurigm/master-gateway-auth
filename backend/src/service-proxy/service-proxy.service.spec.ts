import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Estado } from '@prisma/client';
import { ServiceProxyService } from './service-proxy.service';
import { ServiceIdentityService } from '../external-services/service-identity.service';
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
    code: 'inventario',
    baseUrl: 'http://127.0.0.1:3001',
    authenticationType: 'API_KEY',
    apiKey: 'clave-de-servicio',
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
      new ServiceIdentityService(),
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

  it.each(['SUPER_ADMIN', 'SUPERADMIN', 'ADMIN'])(
    'permite acceso global al proxy para el rol %s',
    async (roleName) => {
      await expect(
        service.forward(createRequest(roleName)),
      ).resolves.toMatchObject({ statusCode: 200 });
      expect(prisma.roleMenu.count).not.toHaveBeenCalled();
    },
  );

  it('una configuracion adicional no puede retirar acceso a ADMIN', async () => {
    service = new ServiceProxyService(
      prisma as unknown as PrismaService,
      new ConfigService({ FULL_ACCESS_ROLE_NAMES: 'AUDITOR' }),
      new ServiceIdentityService(),
    );

    await expect(
      service.forward(createRequest('ADMIN')),
    ).resolves.toMatchObject({ statusCode: 200 });
    expect(prisma.roleMenu.count).not.toHaveBeenCalled();
  });

  it('bloquea roles normales sin item asignado antes de contactar al micro', async () => {
    await expect(service.forward(createRequest('USER'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Identidad de servicio (ADR-3): el micro debe poder distinguir al Gateway
  // legitimo de un impostor en la misma red Docker.
  it('inyecta la identidad de servicio del microservicio destino', async () => {
    await service.forward(createRequest());

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('x-api-key')).toBe('clave-de-servicio');
    expect(headers.get('x-gateway-service')).toBe('master-gateway');
  });

  it('no inyecta identidad de servicio si el micro no tiene clave', async () => {
    prisma.externalServiceRoute.findMany.mockResolvedValue([
      { ...route, service: { ...route.service, apiKey: null } },
    ]);

    await service.forward(createRequest());

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('x-api-key')).toBeNull();
    // Las cabeceras de identidad de USUARIO se siguen enviando.
    expect(headers.get('x-gateway-user-id')).toBe('user-id');
  });

  // Sin esto, cualquier usuario autenticado podria suplantar a otro usuario o
  // falsificar la identidad del Gateway: el micro confia en esas cabeceras
  // precisamente porque asume que solo el Gateway las emite.
  it('descarta las cabeceras de identidad que llegan del cliente', async () => {
    const request = createRequest();
    Object.assign(request.headers, {
      'x-gateway-user-id': 'usuario-suplantado',
      'x-gateway-role-name': 'SUPER_ADMIN',
      'x-api-key': 'clave-falsificada',
      'x-gateway-service': 'impostor',
    });

    await service.forward(request);

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('x-gateway-user-id')).toBe('user-id');
    expect(headers.get('x-api-key')).toBe('clave-de-servicio');
    expect(headers.get('x-gateway-service')).toBe('master-gateway');
  });

  it('propaga los permisos del rol al microservicio', async () => {
    const request = createRequest();
    (request.user as { permissions?: string[] }).permissions = [
      'inventario:read',
      'inventario:write',
    ];

    await service.forward(request);

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('x-gateway-permissions')).toBe(
      'inventario:read,inventario:write',
    );
  });
});
