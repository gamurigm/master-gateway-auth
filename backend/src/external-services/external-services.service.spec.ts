import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Estado } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { ExternalServicesService } from './external-services.service';

const SERVICE_ID = '9f1d2c3b-4a5e-4f6a-8b7c-0d1e2f3a4b5c';
const MODULE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const ROLE_ID = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
const ACTOR_ID = '3c4d5e6f-7a8b-4c9d-8e0f-2a3b4c5d6e7f';

describe('ExternalServicesService', () => {
  let service: ExternalServicesService;
  let prisma: {
    externalService: Record<string, jest.Mock>;
    systemModule: Record<string, jest.Mock>;
    role: Record<string, jest.Mock>;
    menu: Record<string, jest.Mock>;
    roleModule: Record<string, jest.Mock>;
    roleMenu: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let fetchMock: jest.Mock;

  const activeService = {
    id: SERVICE_ID,
    code: 'INVENTARIO',
    name: 'Inventario',
    description: 'Servicio de inventario',
    baseUrl: 'http://inventario.local',
    healthPath: '/health',
    openApiPath: null,
    moduleId: null,
    estado: Estado.ACTIVO,
  };

  beforeEach(() => {
    // Los tests apuntan a hosts privados: se habilita el bypass igual que en
    // docker-compose, para poder ejercitar la logica sin salir a Internet.
    process.env['ALLOW_PRIVATE_PROBE_TARGETS'] = 'true';

    prisma = {
      externalService: {
        findMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(activeService),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({ id: SERVICE_ID, ...data })),
        update: jest.fn().mockImplementation(({ data }) => ({ id: SERVICE_ID, ...data })),
      },
      systemModule: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: MODULE_ID, code: 'INVENTARIO' }),
      },
      role: { findMany: jest.fn().mockResolvedValue([{ id: ROLE_ID }]) },
      menu: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => ({ id: `menu-${data.name}`, ...data })),
      },
      roleModule: { create: jest.fn().mockResolvedValue({}) },
      roleMenu: { create: jest.fn().mockResolvedValue({}) },
      // La transaccion se ejecuta con el mismo mock de prisma.
      $transaction: jest.fn().mockImplementation((callback) => callback(prisma)),
    };

    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    service = new ExternalServicesService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env['ALLOW_PRIVATE_PROBE_TARGETS'];
  });

  describe('probe', () => {
    it('reporta alcanzable cuando el servicio responde 200', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200 });

      const result = await service.probe({ baseUrl: 'http://127.0.0.1:3006' });

      expect(result.reachable).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:3006/health',
        expect.objectContaining({ redirect: 'manual' }),
      );
    });

    it('no sigue redirecciones', async () => {
      // Un 302 hacia 169.254.169.254 saltaria la validacion anti-SSRF, que solo
      // se aplico a la URL original.
      fetchMock.mockResolvedValue({ ok: true, status: 200 });
      await service.probe({ baseUrl: 'http://127.0.0.1:3006' });

      const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(options.redirect).toBe('manual');
    });

    it('reporta no alcanzable sin lanzar cuando la peticion falla', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.probe({ baseUrl: 'http://127.0.0.1:9999' });

      expect(result.reachable).toBe(false);
      expect(result.error).toContain('ECONNREFUSED');
      expect(result.discoveredEndpoints).toEqual([]);
    });

    it('reporta no alcanzable cuando responde con error HTTP', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 503 });

      const result = await service.probe({ baseUrl: 'http://127.0.0.1:3006' });

      expect(result.reachable).toBe(false);
      expect(result.statusCode).toBe(503);
    });

    it('rechaza destinos restringidos cuando no se permiten redes privadas', async () => {
      process.env['ALLOW_PRIVATE_PROBE_TARGETS'] = 'false';

      await expect(
        service.probe({ baseUrl: 'http://169.254.169.254' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('descubre endpoints GET desde el documento OpenAPI', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              paths: {
                '/productos': { get: { summary: 'Listar productos' }, post: {} },
                '/stock': { get: { operationId: 'getStock' } },
              },
            }),
        });

      const result = await service.probe({
        baseUrl: 'http://127.0.0.1:3006',
        openApiPath: '/openapi.json',
      });

      expect(result.discoveredEndpoints).toEqual([
        { name: 'Listar productos', path: '/productos', method: 'GET' },
        { name: 'getStock', path: '/stock', method: 'GET' },
      ]);
    });

    it('un OpenAPI invalido no invalida el probe de salud', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({ ok: true, status: 200, text: async () => 'no-es-json' });

      const result = await service.probe({
        baseUrl: 'http://127.0.0.1:3006',
        openApiPath: '/openapi.json',
      });

      expect(result.reachable).toBe(true);
      expect(result.discoveredEndpoints).toEqual([]);
    });
  });

  describe('create', () => {
    it('rechaza el alta si el servicio no responde', async () => {
      // Registrar un servicio inalcanzable generaria menus rotos.
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        service.create(
          { code: 'INVENTARIO', name: 'Inventario', baseUrl: 'http://127.0.0.1:9999' },
          ACTOR_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.externalService.create).not.toHaveBeenCalled();
    });

    it('rechaza un codigo duplicado', async () => {
      prisma.externalService.findUnique.mockResolvedValue({ id: SERVICE_ID });

      await expect(
        service.create(
          { code: 'INVENTARIO', name: 'Inventario', baseUrl: 'http://127.0.0.1:3006' },
          ACTOR_ID,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('registra el servicio y guarda el resultado del probe', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200 });

      const created = await service.create(
        { code: 'INVENTARIO', name: 'Inventario', baseUrl: 'http://127.0.0.1:3006' },
        ACTOR_ID,
      );

      expect(created).toMatchObject({ code: 'INVENTARIO', lastProbeOk: true, createdBy: ACTOR_ID });
    });
  });

  describe('provision', () => {
    const dto = {
      roleIds: [ROLE_ID],
      items: [
        { name: 'Productos', path: '/app/inventario/productos' },
        { name: 'Stock', path: '/app/inventario/stock' },
      ],
    };

    it('crea modulo, menu raiz sin url y una hoja por endpoint', async () => {
      const result = await service.provision(SERVICE_ID, dto, ACTOR_ID);

      expect(prisma.systemModule.create).toHaveBeenCalled();
      expect(prisma.menu.create).toHaveBeenCalledTimes(3); // 1 raiz + 2 hojas

      const [rootCall] = prisma.menu.create.mock.calls;
      expect(rootCall[0].data).toMatchObject({ url: null, parentId: null });

      // Solo los nodos hoja llevan url (seccion 4.1 del PDF).
      const leafCalls = prisma.menu.create.mock.calls.slice(1);
      for (const call of leafCalls) {
        expect(call[0].data.url).toMatch(/^\/app\/inventario\//);
        expect(call[0].data.parentId).toBeDefined();
      }

      expect(result.menus).toBe(3);
    });

    it('asigna modulo y todos los menus a cada rol indicado', async () => {
      await service.provision(SERVICE_ID, dto, ACTOR_ID);

      expect(prisma.roleModule.create).toHaveBeenCalledTimes(1);
      expect(prisma.roleMenu.create).toHaveBeenCalledTimes(3);
    });

    it('ejecuta todo dentro de una transaccion', async () => {
      await service.provision(SERVICE_ID, dto, ACTOR_ID);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('rechaza aprovisionar dos veces el mismo servicio', async () => {
      prisma.externalService.findFirst.mockResolvedValue({
        ...activeService,
        moduleId: MODULE_ID,
      });

      await expect(service.provision(SERVICE_ID, dto, ACTOR_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rechaza roles inexistentes o inactivos', async () => {
      prisma.role.findMany.mockResolvedValue([]);

      await expect(service.provision(SERVICE_ID, dto, ACTOR_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza si ya existe un modulo con ese codigo', async () => {
      prisma.systemModule.findUnique.mockResolvedValue({ id: MODULE_ID });

      await expect(service.provision(SERVICE_ID, dto, ACTOR_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  it('findOne lanza NotFound cuando el servicio no existe o esta inactivo', async () => {
    prisma.externalService.findFirst.mockResolvedValue(null);

    await expect(service.findOne(SERVICE_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove hace soft delete, no borrado fisico', async () => {
    await service.remove(SERVICE_ID, ACTOR_ID);

    expect(prisma.externalService.update).toHaveBeenCalledWith({
      where: { id: SERVICE_ID },
      data: { estado: Estado.INACTIVO, updatedBy: ACTOR_ID },
    });
  });
});
