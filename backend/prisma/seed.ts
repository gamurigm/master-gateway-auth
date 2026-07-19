import { PrismaClient, Estado } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  ADMIN_PERMISSION_CODES,
  ALL_PERMISSION_CODES,
  GUEST_PERMISSION_CODES,
  PERMISSIONS,
  SYSTEM_ROLES,
} from '../src/common/policy/permission-catalog';

const prisma = new PrismaClient();

const ids = {
  adminUser: '11111111-1111-4111-8111-111111111111',
  operatorAdminUser: '11111112-1111-4111-8111-111111111112',
  demoUser: '22222222-2222-4222-8222-222222222222',
  salesUser: '33333333-3333-4333-8333-333333333333',
  inventoryUser: '33333334-3333-4333-8333-333333333334',
  superAdminRole: '44444440-4444-4444-8444-444444444440',
  adminRole: '44444444-4444-4444-8444-444444444444',
  guestRole: '55555555-5555-4555-8555-555555555555',
  salesRole: '66666666-6666-4666-8666-666666666666',
  inventoryRole: '66666667-6666-4666-8666-666666666667',
  adminModule: '77777777-7777-4777-8777-777777777777',
  salesModule: '88888888-8888-4888-8888-888888888888',
  inventoryModule: '88888889-8888-4888-8888-888888888889',
  adminMenu: '99999999-9999-4999-8999-999999999999',
  usersMenu: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  rolesMenu: 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  modulesMenu: 'aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  menusMenu: 'aaaaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
  salesMenu: 'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  ordersMenu: 'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  inventoryMenu: 'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1',
  productsMenu: 'ccccccc2-cccc-4ccc-8ccc-ccccccccccc2',
} as const;

async function cleanInvalidLegacyMenus() {
  const legacyIds = [
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000005',
  ];

  await prisma.roleMenu.deleteMany({ where: { menuId: { in: legacyIds } } });
  await prisma.menu.deleteMany({ where: { id: { in: legacyIds } } });
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin12345!';
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? 'Demo12345!';
  const passwordHash = await argon2.hash(adminPassword, { type: argon2.argon2id });
  const demoPasswordHash = await argon2.hash(demoPassword, { type: argon2.argon2id });

  if (process.env.SEED_RESET === 'true') {
    await prisma.refreshToken.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.roleMenu.deleteMany();
    await prisma.roleModule.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.menu.deleteMany();
    await prisma.systemModule.deleteMany();
    await prisma.role.deleteMany();
    await prisma.user.deleteMany();
    console.log('Base de datos limpiada por SEED_RESET=true');
  } else {
    await cleanInvalidLegacyMenus();
  }

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { id: ids.adminUser, estado: Estado.ACTIVO, passwordHash, firstName: 'Admin', lastName: 'Master' },
    create: { id: ids.adminUser, email: adminEmail, passwordHash, firstName: 'Admin', lastName: 'Master' },
  });

  const operatorAdmin = await prisma.user.upsert({
    where: { email: 'admin-operador@example.com' },
    update: { id: ids.operatorAdminUser, estado: Estado.ACTIVO, passwordHash: demoPasswordHash, firstName: 'Admin', lastName: 'Operador' },
    create: { id: ids.operatorAdminUser, email: 'admin-operador@example.com', passwordHash: demoPasswordHash, firstName: 'Admin', lastName: 'Operador' },
  });

  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: { id: ids.demoUser, estado: Estado.ACTIVO, passwordHash: demoPasswordHash, firstName: 'Usuario', lastName: 'Demo' },
    create: { id: ids.demoUser, email: 'demo@example.com', passwordHash: demoPasswordHash, firstName: 'Usuario', lastName: 'Demo' },
  });

  const salesUser = await prisma.user.upsert({
    where: { email: 'ventas@example.com' },
    update: { id: ids.salesUser, estado: Estado.ACTIVO, passwordHash: demoPasswordHash, firstName: 'Usuario', lastName: 'Ventas' },
    create: { id: ids.salesUser, email: 'ventas@example.com', passwordHash: demoPasswordHash, firstName: 'Usuario', lastName: 'Ventas' },
  });

  const inventoryUser = await prisma.user.upsert({
    where: { email: 'inventario@example.com' },
    update: { id: ids.inventoryUser, estado: Estado.ACTIVO, passwordHash: demoPasswordHash, firstName: 'Usuario', lastName: 'Inventario' },
    create: { id: ids.inventoryUser, email: 'inventario@example.com', passwordHash: demoPasswordHash, firstName: 'Usuario', lastName: 'Inventario' },
  });

  const superAdminRole = await prisma.role.upsert({ where: { id: ids.superAdminRole }, update: { name: SYSTEM_ROLES.SUPERADMIN, description: 'Control total, incluido borrado fisico', estado: Estado.ACTIVO }, create: { id: ids.superAdminRole, name: SYSTEM_ROLES.SUPERADMIN, description: 'Control total, incluido borrado fisico' } });
  const adminRole = await prisma.role.upsert({ where: { id: ids.adminRole }, update: { name: SYSTEM_ROLES.ADMIN, description: 'Administrador sin borrado fisico', estado: Estado.ACTIVO }, create: { id: ids.adminRole, name: SYSTEM_ROLES.ADMIN, description: 'Administrador sin borrado fisico' } });
  const guestRole = await prisma.role.upsert({ where: { id: ids.guestRole }, update: { name: SYSTEM_ROLES.INVITADO, description: 'Acceso de solo lectura', estado: Estado.ACTIVO }, create: { id: ids.guestRole, name: SYSTEM_ROLES.INVITADO, description: 'Acceso de solo lectura' } });
  const salesRole = await prisma.role.upsert({ where: { name: 'VENTAS' }, update: { id: ids.salesRole, estado: Estado.ACTIVO }, create: { id: ids.salesRole, name: 'VENTAS', description: 'Acceso al servicio de ventas' } });
  const inventoryRole = await prisma.role.upsert({ where: { name: 'INVENTARIO' }, update: { id: ids.inventoryRole, estado: Estado.ACTIVO }, create: { id: ids.inventoryRole, name: 'INVENTARIO', description: 'Acceso al servicio de inventario' } });

  for (const [userId, roleId] of [
    [admin.id, superAdminRole.id],
    [operatorAdmin.id, adminRole.id],
    [demoUser.id, guestRole.id],
    [salesUser.id, salesRole.id],
    [inventoryUser.id, inventoryRole.id],
  ] as const) {
    await prisma.userRole.upsert({ where: { userId_roleId: { userId, roleId } }, update: { estado: Estado.ACTIVO }, create: { userId, roleId, estado: Estado.ACTIVO, createdBy: admin.id } });
  }

  const adminModule = await prisma.systemModule.upsert({ where: { code: 'ADMIN' }, update: { id: ids.adminModule, estado: Estado.ACTIVO }, create: { id: ids.adminModule, code: 'ADMIN', name: 'Administracion', description: 'Gestion de identidad, roles, modulos y menus', createdBy: admin.id } });
  const salesModule = await prisma.systemModule.upsert({ where: { code: 'VENTAS' }, update: { id: ids.salesModule, estado: Estado.ACTIVO }, create: { id: ids.salesModule, code: 'VENTAS', name: 'Ventas', description: 'Operacion de pedidos y ventas', createdBy: admin.id } });
  const inventoryModule = await prisma.systemModule.upsert({ where: { code: 'INVENTARIO' }, update: { id: ids.inventoryModule, estado: Estado.ACTIVO }, create: { id: ids.inventoryModule, code: 'INVENTARIO', name: 'Inventario', description: 'Operacion de productos e inventario', createdBy: admin.id } });

  for (const [roleId, moduleId] of [
    [superAdminRole.id, adminModule.id],
    [superAdminRole.id, salesModule.id],
    [superAdminRole.id, inventoryModule.id],
    [adminRole.id, adminModule.id],
    [adminRole.id, salesModule.id],
    [adminRole.id, inventoryModule.id],
    [guestRole.id, adminModule.id],
    [guestRole.id, salesModule.id],
    [guestRole.id, inventoryModule.id],
    [salesRole.id, salesModule.id],
    [inventoryRole.id, inventoryModule.id],
  ] as const) {
    await prisma.roleModule.upsert({ where: { roleId_moduleId: { roleId, moduleId } }, update: { estado: Estado.ACTIVO }, create: { roleId, moduleId, estado: Estado.ACTIVO, createdBy: admin.id } });
  }

  const menus = [
    { id: ids.adminMenu, name: 'Administracion', url: undefined, icon: 'settings', order: 0, moduleId: adminModule.id, parentId: undefined },
    { id: ids.usersMenu, name: 'Usuarios', url: '/app/users', icon: 'users', order: 1, moduleId: adminModule.id, parentId: ids.adminMenu },
    { id: ids.rolesMenu, name: 'Roles', url: '/app/roles', icon: 'shield', order: 2, moduleId: adminModule.id, parentId: ids.adminMenu },
    { id: ids.modulesMenu, name: 'Modulos', url: '/app/modules', icon: 'boxes', order: 3, moduleId: adminModule.id, parentId: ids.adminMenu },
    { id: ids.menusMenu, name: 'Menus', url: '/app/menus', icon: 'menu', order: 4, moduleId: adminModule.id, parentId: ids.adminMenu },
    { id: ids.salesMenu, name: 'Ventas', url: '/app/sales', icon: 'shopping-cart', order: 1, moduleId: salesModule.id, parentId: undefined },
    { id: ids.ordersMenu, name: 'Pedidos', url: '/ventas/ordenes', icon: 'receipt', order: 2, moduleId: salesModule.id, parentId: ids.salesMenu },
    { id: ids.inventoryMenu, name: 'Inventario', url: '/app/inventario', icon: 'boxes', order: 1, moduleId: inventoryModule.id, parentId: undefined },
    { id: ids.productsMenu, name: 'Productos', url: '/app/inventario', icon: 'package', order: 2, moduleId: inventoryModule.id, parentId: ids.inventoryMenu },
  ];

  for (const menuData of menus) {
    const menu = await prisma.menu.upsert({ where: { id: menuData.id }, update: { ...menuData, estado: Estado.ACTIVO }, create: { ...menuData, estado: Estado.ACTIVO, createdBy: admin.id } });
    const roleIds = menuData.moduleId === salesModule.id
      ? [superAdminRole.id, adminRole.id, guestRole.id, salesRole.id]
      : menuData.moduleId === inventoryModule.id
        ? [superAdminRole.id, adminRole.id, guestRole.id, inventoryRole.id]
        : [superAdminRole.id, adminRole.id, guestRole.id];

    for (const roleId of roleIds) {
      await prisma.roleMenu.upsert({ where: { roleId_menuId: { roleId, menuId: menu.id } }, update: { estado: Estado.ACTIVO }, create: { roleId, menuId: menu.id, estado: Estado.ACTIVO, createdBy: admin.id } });
    }
  }

  const permissionByCode = new Map<string, { id: string }>();
  for (const permissionData of PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: { code: permissionData.code },
      update: { ...permissionData, estado: Estado.ACTIVO, updatedBy: admin.id },
      create: { ...permissionData, estado: Estado.ACTIVO, createdBy: admin.id },
      select: { id: true, code: true },
    });
    permissionByCode.set(permission.code, permission);
  }

  const assignPermissions = async (roleId: string, permissionCodes: string[]) => {
    for (const code of permissionCodes) {
      const permission = permissionByCode.get(code);
      if (!permission) {
        throw new Error(`Permiso no encontrado en catalogo: ${code}`);
      }

      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: permission.id } },
        update: { estado: Estado.ACTIVO, updatedBy: admin.id },
        create: { roleId, permissionId: permission.id, estado: Estado.ACTIVO, createdBy: admin.id },
      });
    }
  };

  await assignPermissions(superAdminRole.id, ALL_PERMISSION_CODES);
  await assignPermissions(adminRole.id, ADMIN_PERMISSION_CODES);
  await assignPermissions(guestRole.id, GUEST_PERMISSION_CODES);
  await assignPermissions(salesRole.id, ['sales:read']);
  await assignPermissions(inventoryRole.id, ['inventory:read']);

  console.log(JSON.stringify({ message: 'Seed completado', users: [adminEmail, 'admin-operador@example.com', 'demo@example.com', 'ventas@example.com', 'inventario@example.com'], demoPassword, uuidVersion: 'v4' }, null, 2));
}

main()
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
