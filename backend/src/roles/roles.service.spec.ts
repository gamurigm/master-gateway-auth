import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Estado } from '@prisma/client';
import { RolesService } from './roles.service';
import { PrismaService } from '../prisma/prisma.service';

const ROLE_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const MODULE_ID = '33333333-3333-3333-3333-333333333333';
const MENU_ID = '44444444-4444-4444-4444-444444444444';
const ACTOR_ID = '55555555-5555-5555-5555-555555555555';

describe('RolesService', () => {
  let service: RolesService;
  let prisma: {
    role: { findMany: jest.Mock; findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    user: { findFirst: jest.Mock };
    userRole: { count: jest.Mock; upsert: jest.Mock; update: jest.Mock };
    systemModule: { findFirst: jest.Mock };
    menu: { findFirst: jest.Mock };
    roleModule: { upsert: jest.Mock; update: jest.Mock };
    roleMenu: { upsert: jest.Mock; update: jest.Mock };
  };

  const activeRole = () => ({
    id: ROLE_ID,
    name: 'ADMIN',
    description: 'Administrator',
    estado: Estado.ACTIVO,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
  });

  beforeEach(() => {
    prisma = {
      role: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      user: { findFirst: jest.fn() },
      userRole: { count: jest.fn(), upsert: jest.fn(), update: jest.fn() },
      systemModule: { findFirst: jest.fn() },
      menu: { findFirst: jest.fn() },
      roleModule: { upsert: jest.fn(), update: jest.fn() },
      roleMenu: { upsert: jest.fn(), update: jest.fn() },
    };
    jest.clearAllMocks();
    service = new RolesService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('returns active roles ordered by name', async () => {
      prisma.role.findMany.mockResolvedValue([activeRole()]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(prisma.role.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { estado: Estado.ACTIVO }, orderBy: { name: 'asc' } }),
      );
    });
  });

  describe('create', () => {
    it('creates a new role', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      prisma.role.create.mockResolvedValue(activeRole());

      const result = await service.create({ name: 'ADMIN', description: 'Administrator' }, ACTOR_ID);

      expect(result.name).toBe('ADMIN');
      expect(prisma.role.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'ADMIN', createdBy: ACTOR_ID }) }),
      );
    });

    it('throws ConflictException if role name exists', async () => {
      prisma.role.findUnique.mockResolvedValue(activeRole());

      await expect(service.create({ name: 'ADMIN' }, ACTOR_ID)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update', () => {
    it('updates an existing role', async () => {
      prisma.role.findFirst.mockResolvedValue(activeRole());
      prisma.role.update.mockResolvedValue({ ...activeRole(), description: 'Updated' });

      const result = await service.update(ROLE_ID, { description: 'Updated' }, ACTOR_ID);

      expect(result.description).toBe('Updated');
    });

    it('throws NotFoundException for missing role', async () => {
      prisma.role.findFirst.mockResolvedValue(null);

      await expect(service.update(ROLE_ID, { description: 'Updated' }, ACTOR_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft-deletes a role with no active assignments', async () => {
      prisma.role.findFirst.mockResolvedValue(activeRole());
      prisma.userRole.count.mockResolvedValue(0);

      const result = await service.remove(ROLE_ID, ACTOR_ID);

      expect(result).toEqual({ success: true });
      expect(prisma.role.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ROLE_ID }, data: expect.objectContaining({ estado: Estado.INACTIVO }) }),
      );
    });

    it('throws BadRequestException when role has active user assignments', async () => {
      prisma.role.findFirst.mockResolvedValue(activeRole());
      prisma.userRole.count.mockResolvedValue(3);

      await expect(service.remove(ROLE_ID, ACTOR_ID)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('assignUser / unassignUser', () => {
    it('assigns user to role with upsert', async () => {
      prisma.role.findFirst.mockResolvedValue(activeRole());
      prisma.user.findFirst.mockResolvedValue({ id: USER_ID, estado: Estado.ACTIVO });
      prisma.userRole.upsert.mockResolvedValue({ userId: USER_ID, roleId: ROLE_ID });

      const result = await service.assignUser(ROLE_ID, USER_ID, ACTOR_ID);

      expect(prisma.userRole.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_roleId: { userId: USER_ID, roleId: ROLE_ID } },
          create: expect.objectContaining({ userId: USER_ID, roleId: ROLE_ID, createdBy: ACTOR_ID }),
        }),
      );
    });

    it('unassigns user from role with soft delete', async () => {
      prisma.role.findFirst.mockResolvedValue(activeRole());
      prisma.user.findFirst.mockResolvedValue({ id: USER_ID, estado: Estado.ACTIVO });

      const result = await service.unassignUser(ROLE_ID, USER_ID, ACTOR_ID);

      expect(result).toEqual({ success: true });
      expect(prisma.userRole.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_roleId: { userId: USER_ID, roleId: ROLE_ID } },
          data: expect.objectContaining({ estado: Estado.INACTIVO }),
        }),
      );
    });
  });

  describe('assignModule / unassignModule', () => {
    it('assigns module to role', async () => {
      prisma.role.findFirst.mockResolvedValue(activeRole());
      prisma.systemModule.findFirst.mockResolvedValue({ id: MODULE_ID, estado: Estado.ACTIVO });

      await service.assignModule(ROLE_ID, MODULE_ID, ACTOR_ID);

      expect(prisma.roleModule.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roleId_moduleId: { roleId: ROLE_ID, moduleId: MODULE_ID } },
          create: expect.objectContaining({ roleId: ROLE_ID, moduleId: MODULE_ID, createdBy: ACTOR_ID }),
        }),
      );
    });

    it('unassigns module from role', async () => {
      prisma.role.findFirst.mockResolvedValue(activeRole());
      prisma.systemModule.findFirst.mockResolvedValue({ id: MODULE_ID, estado: Estado.ACTIVO });

      const result = await service.unassignModule(ROLE_ID, MODULE_ID, ACTOR_ID);

      expect(result).toEqual({ success: true });
      expect(prisma.roleModule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roleId_moduleId: { roleId: ROLE_ID, moduleId: MODULE_ID } },
          data: expect.objectContaining({ estado: Estado.INACTIVO }),
        }),
      );
    });
  });

  describe('assignMenu / unassignMenu', () => {
    it('assigns menu to role', async () => {
      prisma.role.findFirst.mockResolvedValue(activeRole());
      prisma.menu.findFirst.mockResolvedValue({ id: MENU_ID, estado: Estado.ACTIVO });

      await service.assignMenu(ROLE_ID, MENU_ID, ACTOR_ID);

      expect(prisma.roleMenu.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roleId_menuId: { roleId: ROLE_ID, menuId: MENU_ID } },
          create: expect.objectContaining({ roleId: ROLE_ID, menuId: MENU_ID, createdBy: ACTOR_ID }),
        }),
      );
    });

    it('unassigns menu from role', async () => {
      prisma.role.findFirst.mockResolvedValue(activeRole());
      prisma.menu.findFirst.mockResolvedValue({ id: MENU_ID, estado: Estado.ACTIVO });

      const result = await service.unassignMenu(ROLE_ID, MENU_ID, ACTOR_ID);

      expect(result).toEqual({ success: true });
      expect(prisma.roleMenu.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roleId_menuId: { roleId: ROLE_ID, menuId: MENU_ID } },
          data: expect.objectContaining({ estado: Estado.INACTIVO }),
        }),
      );
    });
  });
});
