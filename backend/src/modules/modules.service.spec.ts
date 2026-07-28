import { ConflictException, NotFoundException } from '@nestjs/common';
import { Estado } from '@prisma/client';
import { ModulesService } from './modules.service';
import { PrismaService } from '../prisma/prisma.service';

const MODULE_ID = '11111111-1111-1111-1111-111111111111';
const MENU_ID = '33333333-3333-3333-3333-333333333333';
const ACTOR_ID = '22222222-2222-2222-2222-222222222222';

describe('ModulesService', () => {
  let service: ModulesService;
  let prisma: {
    $transaction: jest.Mock;
    systemModule: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    menu: { findMany: jest.Mock; updateMany: jest.Mock };
    roleMenu: { updateMany: jest.Mock };
    roleModule: { updateMany: jest.Mock };
    externalServiceRoute: { updateMany: jest.Mock };
  };

  const activeModule = () => ({
    id: MODULE_ID,
    code: 'ADMIN',
    name: 'Administracion',
    description: null,
    estado: Estado.ACTIVO,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
  });

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(prisma),
      ),
      systemModule: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      menu: { findMany: jest.fn(), updateMany: jest.fn() },
      roleMenu: { updateMany: jest.fn() },
      roleModule: { updateMany: jest.fn() },
      externalServiceRoute: { updateMany: jest.fn() },
    };
    jest.clearAllMocks();
    service = new ModulesService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('returns active modules ordered by name', async () => {
      prisma.systemModule.findMany.mockResolvedValue([activeModule()]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(prisma.systemModule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { estado: Estado.ACTIVO },
          orderBy: { name: 'asc' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns module with active menus', async () => {
      prisma.systemModule.findFirst.mockResolvedValue({
        ...activeModule(),
        menus: [],
      });

      const result = await service.findOne(MODULE_ID);

      expect(result.id).toBe(MODULE_ID);
    });

    it('throws NotFoundException when missing', async () => {
      prisma.systemModule.findFirst.mockResolvedValue(null);

      await expect(service.findOne(MODULE_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a new module', async () => {
      prisma.systemModule.findUnique.mockResolvedValue(null);
      prisma.systemModule.create.mockResolvedValue(activeModule());

      const result = await service.create(
        { code: 'ADMIN', name: 'Administracion' },
        ACTOR_ID,
      );

      expect(result.name).toBe('Administracion');
    });

    it('throws ConflictException when code exists', async () => {
      prisma.systemModule.findUnique.mockResolvedValue(activeModule());

      await expect(
        service.create({ code: 'ADMIN', name: 'Administracion' }, ACTOR_ID),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update', () => {
    it('updates an existing module', async () => {
      prisma.systemModule.findFirst.mockResolvedValue(activeModule());
      prisma.systemModule.update.mockResolvedValue({
        ...activeModule(),
        name: 'Updated',
      });

      const result = await service.update(
        MODULE_ID,
        { name: 'Updated' },
        ACTOR_ID,
      );

      expect(result.name).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('soft-deletes the module and its navigation assignments', async () => {
      prisma.systemModule.findFirst.mockResolvedValue(activeModule());
      prisma.menu.findMany.mockResolvedValue([{ id: MENU_ID }]);

      const result = await service.remove(MODULE_ID, ACTOR_ID);

      expect(result).toEqual({ success: true });
      expect(prisma.roleMenu.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { menuId: { in: [MENU_ID] }, estado: Estado.ACTIVO },
          data: expect.objectContaining({ estado: Estado.INACTIVO }),
        }),
      );
      expect(prisma.menu.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { moduleId: MODULE_ID, estado: Estado.ACTIVO },
          data: expect.objectContaining({ estado: Estado.INACTIVO }),
        }),
      );
      expect(prisma.roleModule.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { moduleId: MODULE_ID, estado: Estado.ACTIVO },
          data: expect.objectContaining({ estado: Estado.INACTIVO }),
        }),
      );
      expect(prisma.systemModule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MODULE_ID },
          data: expect.objectContaining({ estado: Estado.INACTIVO }),
        }),
      );
    });
  });
});
