import { BadRequestException } from '@nestjs/common';
import { MenusService } from './menus.service';
import { PrismaService } from '../prisma/prisma.service';

const ROLE_ID = '22222222-2222-2222-2222-222222222222';
const MODULE_ID = '33333333-3333-3333-3333-333333333333';
const OTHER_MODULE_ID = '44444444-4444-4444-4444-444444444444';
const ROOT_MENU_ID = '55555555-5555-5555-5555-555555555555';
const CHILD_MENU_ID = '66666666-6666-6666-6666-666666666666';
const ACTOR_ID = '77777777-7777-7777-7777-777777777777';

describe('MenusService', () => {
  let service: MenusService;

  const prisma = {
    roleMenu: {
      findMany: jest.fn(),
    },
    systemModule: {
      findFirst: jest.fn(),
    },
    menu: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MenusService(prisma as unknown as PrismaService);
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
