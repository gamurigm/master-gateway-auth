import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Estado } from '@prisma/client';
import { MenusService } from './menus.service';
import { PrismaService } from '../prisma/prisma.service';

const ROLE_ID = '22222222-2222-2222-2222-222222222222';
const MODULE_ID = '33333333-3333-3333-3333-333333333333';
const OTHER_MODULE_ID = '44444444-4444-4444-4444-444444444444';
const ROOT_MENU_ID = '55555555-5555-5555-5555-555555555555';
const CHILD_MENU_ID = '66666666-6666-6666-6666-666666666666';
const ACTOR_ID = '77777777-7777-7777-7777-777777777777';
const ROUTE_ID = '88888888-8888-8888-8888-888888888888';
const SERVICE_ID = '99999999-9999-9999-9999-999999999999';

function menuRecord(id: string, name: string, url: string | null, parentId: string | null, order: number) {
  return { id, name, url, icon: null, order, parentId, moduleId: MODULE_ID, module: { id: MODULE_ID, code: 'ADMIN', name: 'Administracion' } };
}

describe('MenusService', () => {
  let service: MenusService;

  const txMock = {
    externalService: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    externalServiceRoute: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() },
    menu: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() },
    roleMenu: { updateMany: jest.fn() },
  };

  const prisma = {
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(txMock)),
    roleMenu: { findMany: jest.fn(), updateMany: jest.fn() },
    externalServiceRoute: { findFirst: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() },
    externalService: { updateMany: jest.fn() },
    systemModule: { findFirst: jest.fn() },
    menu: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(txMock).forEach((m) => (typeof m === 'function' ? undefined : Object.values(m as Record<string, jest.Mock>).forEach((j: jest.Mock) => j.mockReset())));
    service = new MenusService(prisma as unknown as PrismaService);
  });

  describe('treeForRole', () => {
    it('builds a module tree from menus assigned to the active role', async () => {
      const rootRec = menuRecord(ROOT_MENU_ID, 'Administracion', null, null, 0);
      const childRec = menuRecord(CHILD_MENU_ID, 'Usuarios', '/app/users', ROOT_MENU_ID, 1);
      prisma.roleMenu.findMany.mockResolvedValue([
        { menu: rootRec }, { menu: childRec },
      ]);

      await expect(service.treeForRole(ROLE_ID)).resolves.toEqual([
        expect.objectContaining({
          id: MODULE_ID, code: 'ADMIN', name: 'Administracion',
          menus: [expect.objectContaining({
            id: ROOT_MENU_ID, name: 'Administracion',
            children: [expect.objectContaining({ id: CHILD_MENU_ID, name: 'Usuarios', url: '/app/users', children: [] })],
          })],
        }),
      ]);
    });

    it('does not expose child menus when their parent is not visible', async () => {
      prisma.roleMenu.findMany.mockResolvedValue([
        { menu: menuRecord(CHILD_MENU_ID, 'Usuarios', '/app/users', ROOT_MENU_ID, 1) },
      ]);

      await expect(service.treeForRole(ROLE_ID)).resolves.toEqual([]);
    });
  });

  describe('create', () => {
    beforeEach(() => {
      prisma.systemModule.findFirst.mockResolvedValue({ id: MODULE_ID });
    });

    it('creates a simple menu without targetUrl', async () => {
      prisma.menu.create.mockResolvedValue({ id: 'new-menu' });
      const result = await service.create({ name: 'Test', moduleId: MODULE_ID }, ACTOR_ID);
      expect(result).toEqual({ id: 'new-menu' });
      expect(prisma.menu.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Test', moduleId: MODULE_ID, createdBy: ACTOR_ID }),
      });
    });

    it('rejects creating menu under parent from another module', async () => {
      prisma.menu.findFirst.mockResolvedValue({ id: ROOT_MENU_ID, moduleId: OTHER_MODULE_ID });

      await expect(service.create({ name: 'Test', moduleId: MODULE_ID, parentId: ROOT_MENU_ID }, ACTOR_ID))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates ExternalService + ExternalServiceRoute when targetUrl is present', async () => {
      const fakeMenu = { id: 'new-menu-with-route', name: 'Productos' };
      txMock.menu.create.mockResolvedValue(fakeMenu);
      txMock.externalService.create.mockResolvedValue({ id: SERVICE_ID });
      txMock.externalServiceRoute.create.mockResolvedValue({ id: ROUTE_ID });

      const result = await service.create({
        name: 'Productos', url: '/app/inventario/productos', moduleId: MODULE_ID,
        targetUrl: 'http://inventario:3007/inventario/productos', methods: ['GET', 'POST'],
      }, ACTOR_ID);

      expect(result).toEqual(fakeMenu);
      expect(txMock.externalService.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          baseUrl: 'http://inventario:3007', healthPath: '/health', createdBy: ACTOR_ID,
        }),
      });
      expect(txMock.externalServiceRoute.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          serviceId: SERVICE_ID, menuId: fakeMenu.id,
          publicPath: '/inventario/productos', targetPath: '/inventario/productos',
          methods: ['GET', 'POST'], createdBy: ACTOR_ID,
        }),
      });
    });

    it('uses GET as default methods when not specified', async () => {
      txMock.menu.create.mockResolvedValue({ id: 'new-menu' });
      txMock.externalService.create.mockResolvedValue({ id: SERVICE_ID });
      txMock.externalServiceRoute.create.mockResolvedValue({ id: ROUTE_ID });

      await service.create({
        name: 'Test', moduleId: MODULE_ID,
        targetUrl: 'http://test:3000/api/test',
      }, ACTOR_ID);

      expect(txMock.externalServiceRoute.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ methods: ['GET'] }),
      });
    });
  });

  describe('update', () => {
    const currentMenu = { id: ROOT_MENU_ID, moduleId: MODULE_ID, name: 'Old', url: '/app/old', icon: null, order: 0, parentId: null, estado: Estado.ACTIVO };

    beforeEach(() => {
      prisma.menu.findFirst.mockResolvedValue(currentMenu);
      prisma.systemModule.findFirst.mockResolvedValue({ id: MODULE_ID });
    });

    it('rejects menu moves that create cycles', async () => {
      prisma.menu.findUnique.mockResolvedValueOnce({ parentId: ROOT_MENU_ID });

      await expect(service.update(ROOT_MENU_ID, { parentId: CHILD_MENU_ID }, ACTOR_ID))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates route when targetUrl is added to a menu without route', async () => {
      prisma.externalServiceRoute.findFirst.mockResolvedValue(null);
      txMock.menu.update.mockResolvedValue({ id: ROOT_MENU_ID });
      txMock.externalService.create.mockResolvedValue({ id: SERVICE_ID });
      txMock.externalServiceRoute.create.mockResolvedValue({ id: ROUTE_ID });

      const result = await service.update(ROOT_MENU_ID, {
        name: 'Updated', targetUrl: 'http://new:4000/api/new', methods: ['PUT'],
      }, ACTOR_ID);

      expect(result).toBeDefined();
      expect(txMock.externalService.create).toHaveBeenCalled();
      expect(txMock.externalServiceRoute.create).toHaveBeenCalled();
    });

    it('updates existing route when targetUrl changes', async () => {
      prisma.externalServiceRoute.findFirst.mockResolvedValue({
        id: ROUTE_ID, serviceId: SERVICE_ID, methods: ['GET'],
        service: { id: SERVICE_ID, code: '_route_existing' },
      });
      txMock.menu.update.mockResolvedValue({ id: ROOT_MENU_ID });
      txMock.externalServiceRoute.update.mockResolvedValue({ id: ROUTE_ID });
      txMock.externalService.update.mockResolvedValue({ id: SERVICE_ID });

      await service.update(ROOT_MENU_ID, {
        name: 'Updated',
        targetUrl: 'http://new:4000/api/new',
        methods: ['POST'],
      }, ACTOR_ID);

      expect(txMock.externalServiceRoute.update).toHaveBeenCalledWith({
        where: { id: ROUTE_ID },
        data: expect.objectContaining({ targetPath: '/api/new', methods: ['POST'] }),
      });
      expect(txMock.externalService.update).toHaveBeenCalledWith({
        where: { id: SERVICE_ID },
        data: expect.objectContaining({ baseUrl: 'http://new:4000' }),
      });
    });

    it('soft-deletes route and hidden service when targetUrl is cleared', async () => {
      prisma.externalServiceRoute.findFirst.mockResolvedValue({
        id: ROUTE_ID, serviceId: SERVICE_ID, methods: ['GET'],
        service: { id: SERVICE_ID, code: '_route_xxx', baseUrl: 'http://old:3000' },
      });
      txMock.menu.update.mockResolvedValue({ id: ROOT_MENU_ID });

      await service.update(ROOT_MENU_ID, { name: 'NoProxy', targetUrl: '' }, ACTOR_ID);

      expect(txMock.externalServiceRoute.update).toHaveBeenCalledWith({
        where: { id: ROUTE_ID },
        data: expect.objectContaining({ estado: Estado.INACTIVO }),
      });
      expect(txMock.externalService.update).toHaveBeenCalledWith({
        where: { id: SERVICE_ID },
        data: expect.objectContaining({ estado: Estado.INACTIVO }),
      });
    });

    it('does NOT soft-delete external service when route belongs to a non-hidden service', async () => {
      prisma.externalServiceRoute.findFirst.mockResolvedValue({
        id: ROUTE_ID, serviceId: SERVICE_ID, methods: ['GET'],
        service: { id: SERVICE_ID, code: 'VENTAS', baseUrl: 'http://ventas:3006' },
      });
      txMock.menu.update.mockResolvedValue({ id: ROOT_MENU_ID });

      await service.update(ROOT_MENU_ID, { name: 'NoProxy', targetUrl: '' }, ACTOR_ID);

      expect(txMock.externalServiceRoute.update).toHaveBeenCalled();
      expect(txMock.externalService.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const activeMenu = { id: ROOT_MENU_ID, moduleId: MODULE_ID, name: 'Test', url: null, icon: null, order: 0, parentId: null, estado: Estado.ACTIVO };

    beforeEach(() => {
      prisma.menu.findFirst.mockResolvedValue(activeMenu);
    });

    it('soft-deletes a menu subtree and its assignments', async () => {
      prisma.menu.findMany
        .mockResolvedValueOnce([{ id: CHILD_MENU_ID }])
        .mockResolvedValueOnce([]);
      txMock.externalServiceRoute.findMany.mockResolvedValue([]);

      const result = await service.remove(ROOT_MENU_ID, ACTOR_ID);

      expect(result).toEqual({ success: true });
      expect(txMock.roleMenu.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { menuId: { in: [ROOT_MENU_ID, CHILD_MENU_ID] }, estado: Estado.ACTIVO }, data: expect.objectContaining({ estado: Estado.INACTIVO }) }),
      );
      expect(txMock.externalServiceRoute.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { menuId: { in: [ROOT_MENU_ID, CHILD_MENU_ID] }, estado: Estado.ACTIVO }, data: expect.objectContaining({ estado: Estado.INACTIVO }) }),
      );
      expect(txMock.menu.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [ROOT_MENU_ID, CHILD_MENU_ID] }, estado: Estado.ACTIVO }, data: expect.objectContaining({ estado: Estado.INACTIVO }) }),
      );
    });

    it('cascades soft-delete to hidden external services and routes', async () => {
      prisma.menu.findMany.mockResolvedValueOnce([]);
      txMock.externalServiceRoute.findMany.mockResolvedValue([
        { id: ROUTE_ID, service: { id: SERVICE_ID, code: '_route_hidden' } },
      ]);

      await service.remove(ROOT_MENU_ID, ACTOR_ID);

      expect(txMock.externalService.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [SERVICE_ID] }, estado: Estado.ACTIVO },
        data: { estado: Estado.INACTIVO, updatedBy: ACTOR_ID },
      });
    });

    it('does not delete external services that are not hidden routes', async () => {
      prisma.menu.findMany.mockResolvedValueOnce([]);
      txMock.externalServiceRoute.findMany.mockResolvedValue([
        { id: ROUTE_ID, service: { id: SERVICE_ID, code: 'VENTAS' } },
      ]);

      await service.remove(ROOT_MENU_ID, ACTOR_ID);

      expect(txMock.externalService.updateMany).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when menu does not exist', async () => {
      prisma.menu.findFirst.mockResolvedValue(null);

      await expect(service.remove('nonexistent', ACTOR_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
