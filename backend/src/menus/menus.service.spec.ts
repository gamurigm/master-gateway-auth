import { BadRequestException, ConflictException } from '@nestjs/common';
import { Estado } from '@prisma/client';
import { MenusService } from './menus.service';

const ROLE_ID = '22222222-2222-2222-2222-222222222222';
const MODULE_ID = '33333333-3333-3333-3333-333333333333';
const OTHER_MODULE_ID = '44444444-4444-4444-4444-444444444444';
const ROOT_MENU_ID = '55555555-5555-5555-5555-555555555555';
const CHILD_MENU_ID = '66666666-6666-6666-6666-666666666666';
const ACTOR_ID = '77777777-7777-7777-7777-777777777777';

describe('MenusService', () => {
  let service: MenusService;

  const prisma = {
    $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
      callback(prisma),
    ),
    roleMenu: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    externalServiceRoute: {
      updateMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    externalService: {
      create: jest.fn(),
      update: jest.fn(),
    },
    systemModule: {
      findFirst: jest.fn(),
    },
    menu: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MenusService(prisma);
    // Los destinos de prueba resuelven a rangos privados; el guard anti-SSRF
    // los permite solo con esta variable, igual que en docker-compose.
    process.env['ALLOW_PRIVATE_PROBE_TARGETS'] = 'true';
  });

  it('builds a module tree from menus assigned to the active role', async () => {
    prisma.roleMenu.findMany.mockResolvedValue([
      {
        menu: menuRecord(ROOT_MENU_ID, 'Administracion', null, null, 0),
      },
      {
        menu: menuRecord(
          CHILD_MENU_ID,
          'Usuarios',
          '/app/users',
          ROOT_MENU_ID,
          1,
        ),
      },
    ]);

    await expect(service.treeForRole(ROLE_ID)).resolves.toEqual([
      {
        id: MODULE_ID,
        code: 'ADMIN',
        name: 'Administracion',
        menus: [
          expect.objectContaining({
            id: ROOT_MENU_ID,
            name: 'Administracion',
            children: [
              expect.objectContaining({
                id: CHILD_MENU_ID,
                name: 'Usuarios',
                url: '/app/users',
                children: [],
              }),
            ],
          }),
        ],
      },
    ]);
  });

  it('does not expose child menus when their parent is not visible', async () => {
    prisma.roleMenu.findMany.mockResolvedValue([
      {
        menu: menuRecord(
          CHILD_MENU_ID,
          'Usuarios',
          '/app/users',
          ROOT_MENU_ID,
          1,
        ),
      },
    ]);

    await expect(service.treeForRole(ROLE_ID)).resolves.toEqual([]);
  });

  it('rejects creating a menu under a parent from another module', async () => {
    prisma.systemModule.findFirst.mockResolvedValue({ id: MODULE_ID });
    prisma.menu.findFirst.mockResolvedValue({
      id: ROOT_MENU_ID,
      moduleId: OTHER_MODULE_ID,
    });

    await expect(
      service.create(
        {
          name: 'Usuarios',
          url: '/app/users',
          order: 1,
          moduleId: MODULE_ID,
          parentId: ROOT_MENU_ID,
        },
        ACTOR_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects menu moves that create cycles', async () => {
    prisma.menu.findFirst.mockResolvedValue({
      id: ROOT_MENU_ID,
      moduleId: MODULE_ID,
    });
    prisma.systemModule.findFirst.mockResolvedValue({ id: MODULE_ID });
    prisma.menu.findUnique.mockResolvedValueOnce({ parentId: ROOT_MENU_ID });

    await expect(
      service.update(ROOT_MENU_ID, { parentId: CHILD_MENU_ID }, ACTOR_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('soft-deletes a menu subtree and its assignments', async () => {
    prisma.menu.findFirst.mockResolvedValue({
      id: ROOT_MENU_ID,
      moduleId: MODULE_ID,
      estado: Estado.ACTIVO,
    });
    prisma.menu.findMany
      .mockResolvedValueOnce([{ id: CHILD_MENU_ID }])
      .mockResolvedValueOnce([]);
    prisma.externalServiceRoute.findMany.mockResolvedValue([]);

    const result = await service.remove(ROOT_MENU_ID, ACTOR_ID);

    expect(result).toEqual({ success: true });
    expect(prisma.roleMenu.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          menuId: { in: [ROOT_MENU_ID, CHILD_MENU_ID] },
          estado: Estado.ACTIVO,
        },
        data: expect.objectContaining({ estado: Estado.INACTIVO }),
      }),
    );
    expect(prisma.menu.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: [ROOT_MENU_ID, CHILD_MENU_ID] },
          estado: Estado.ACTIVO,
        },
        data: expect.objectContaining({ estado: Estado.INACTIVO }),
      }),
    );
  });

  // ─────────────────────────────────────────────────────────────────
  // Enrutado a microservicio desde el alta del menu.
  // ─────────────────────────────────────────────────────────────────
  describe('proxy route', () => {
    // `localhost` y no `inventario`: el guard anti-SSRF resuelve DNS de verdad
    // antes de aceptar el destino, y un nombre de servicio de docker-compose no
    // resuelve fuera de esa red.
    const TARGET = 'http://localhost:3007/inventario/productos';
    const newMenuDto = (overrides: Record<string, unknown> = {}) => ({
      name: 'Productos',
      url: '/app/inventario/productos',
      moduleId: MODULE_ID,
      order: 0,
      targetUrl: TARGET,
      ...overrides,
    });

    beforeEach(() => {
      prisma.systemModule.findFirst.mockResolvedValue({ id: MODULE_ID });
      prisma.menu.create.mockResolvedValue({
        id: CHILD_MENU_ID,
        name: 'Productos',
        url: '/app/inventario/productos',
        moduleId: MODULE_ID,
      });
      prisma.menu.findUniqueOrThrow.mockResolvedValue({ id: CHILD_MENU_ID });
      prisma.externalServiceRoute.findUnique.mockResolvedValue(null);
      prisma.externalService.create.mockResolvedValue({ id: 'service-id' });
    });

    it('creates the hidden service and the route derived from targetUrl', async () => {
      await service.create(newMenuDto(), ACTOR_ID);

      // El menu se crea ANTES que el servicio: el codigo del servicio se
      // deriva de su id, que no existe hasta ese momento.
      expect(prisma.externalService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: `_route_${CHILD_MENU_ID}`,
            baseUrl: 'http://localhost:3007',
          }),
        }),
      );
      expect(prisma.externalServiceRoute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            menuId: CHILD_MENU_ID,
            serviceId: 'service-id',
            publicPath: '/inventario/productos',
            targetPath: '/inventario/productos',
            methods: ['GET'],
          }),
        }),
      );
    });

    it('normalises and de-duplicates the requested methods', async () => {
      await service.create(
        newMenuDto({ methods: ['get', 'POST', 'get'] }),
        ACTOR_ID,
      );

      expect(prisma.externalServiceRoute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ methods: ['GET', 'POST'] }),
        }),
      );
    });

    it('creates a plain navigation menu when no targetUrl is given', async () => {
      await service.create(newMenuDto({ targetUrl: undefined }), ACTOR_ID);

      expect(prisma.externalService.create).not.toHaveBeenCalled();
      expect(prisma.externalServiceRoute.create).not.toHaveBeenCalled();
    });

    it('rejects a targetUrl when the menu url is not an /app/ route', async () => {
      await expect(
        service.create(
          newMenuDto({ url: 'https://externo.example.com' }),
          ACTOR_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    // El proxy del Master haria la peticion saliente, asi que `menus:write` no
    // puede ser una puerta mas debil que el modulo External Services.
    it('rejects a targetUrl pointing at a restricted address (SSRF)', async () => {
      process.env['ALLOW_PRIVATE_PROBE_TARGETS'] = 'false';

      await expect(
        service.create(
          newMenuDto({ targetUrl: 'http://169.254.169.254/latest/meta-data' }),
          ACTOR_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.menu.create).not.toHaveBeenCalled();
    });

    it('refuses to steal a public path already used by another active menu', async () => {
      prisma.externalServiceRoute.findUnique.mockResolvedValue({
        id: 'other-route',
        menuId: ROOT_MENU_ID,
        estado: Estado.ACTIVO,
      });

      await expect(
        service.create(newMenuDto(), ACTOR_ID),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    // `publicPath` es UNICO con independencia del estado, asi que una ruta ya
    // desactivada bloquearia para siempre la reutilizacion de esa URL.
    it('frees a public path held by an inactive route', async () => {
      prisma.externalServiceRoute.findUnique.mockResolvedValue({
        id: 'stale-route',
        menuId: ROOT_MENU_ID,
        estado: Estado.INACTIVO,
      });

      await service.create(newMenuDto(), ACTOR_ID);

      expect(prisma.externalServiceRoute.update).toHaveBeenCalledWith({
        where: { id: 'stale-route' },
        data: { publicPath: '/inventario/productos#retirada-stale-route' },
      });
      expect(prisma.externalServiceRoute.create).toHaveBeenCalled();
    });

    it('deactivates the route and frees its path when targetUrl is cleared', async () => {
      prisma.menu.findFirst.mockResolvedValue({
        id: CHILD_MENU_ID,
        moduleId: MODULE_ID,
        url: '/app/inventario/productos',
      });
      prisma.externalServiceRoute.findUnique.mockResolvedValue({
        id: 'route-id',
        menuId: CHILD_MENU_ID,
        serviceId: 'service-id',
        service: { code: `_route_${CHILD_MENU_ID}` },
      });
      prisma.externalServiceRoute.findUniqueOrThrow.mockResolvedValue({
        id: 'route-id',
        menuId: CHILD_MENU_ID,
        serviceId: 'service-id',
        publicPath: '/inventario/productos',
        service: { code: `_route_${CHILD_MENU_ID}` },
      });
      prisma.menu.update.mockResolvedValue({ id: CHILD_MENU_ID });

      await service.update(CHILD_MENU_ID, { targetUrl: null }, ACTOR_ID);

      expect(prisma.externalServiceRoute.update).toHaveBeenCalledWith({
        where: { id: 'route-id' },
        data: expect.objectContaining({
          estado: Estado.INACTIVO,
          publicPath: '/inventario/productos#retirada-route-id',
        }),
      });
      // El servicio implicito se desactiva con su ruta.
      expect(prisma.externalService.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'service-id' },
          data: expect.objectContaining({ estado: Estado.INACTIVO }),
        }),
      );
    });

    it('exposes targetUrl rebuilt from the service and the route', async () => {
      prisma.menu.findFirst.mockResolvedValue({
        id: CHILD_MENU_ID,
        name: 'Productos',
        proxyRoute: {
          estado: Estado.ACTIVO,
          targetPath: '/inventario/productos',
          methods: ['GET', 'POST'],
          service: { baseUrl: 'http://inventario:3007' },
        },
      });

      await expect(service.findOne(CHILD_MENU_ID)).resolves.toMatchObject({
        targetUrl: 'http://inventario:3007/inventario/productos',
        methods: ['GET', 'POST'],
      });
    });

    it('reports no targetUrl when the route is inactive', async () => {
      prisma.menu.findFirst.mockResolvedValue({
        id: CHILD_MENU_ID,
        proxyRoute: {
          estado: Estado.INACTIVO,
          targetPath: '/inventario/productos',
          methods: ['GET'],
          service: { baseUrl: 'http://inventario:3007' },
        },
      });

      await expect(service.findOne(CHILD_MENU_ID)).resolves.toMatchObject({
        targetUrl: null,
        methods: [],
      });
    });
  });

  const menuRecord = (
    id: string,
    name: string,
    url: string | null,
    parentId: string | null,
    order: number,
  ) => ({
    id,
    name,
    url,
    icon: null,
    order,
    parentId,
    moduleId: MODULE_ID,
    module: {
      id: MODULE_ID,
      code: 'ADMIN',
      name: 'Administracion',
    },
  });
});
