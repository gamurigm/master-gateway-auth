import { PrismaClient, Estado } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// UUID v4 generados aleatoriamente con crypto.randomUUID().
// Son EXACTAMENTE los mismos que usa prisma/seeds/seed.sql, de modo que ambos
// caminos de siembra convergen al mismo estado.
//
// Se descartaron los IDs anteriores (11111111-1111-4111-8111-..., aaaaaaa1-...):
// eran v4 sintacticamente validos, pero con un patron fijo en lugar de aleatorios.
const ids = {
  adminUser: '3d5f0471-39fe-42b8-be26-bc6569492279',
  demoUser: 'dae15021-602e-493d-b5c3-23882e7c529c',
  salesUser: '87ef858a-1961-40b6-91f5-3a6871ae3ac4',
  adminRole: 'bed7be1f-4d90-4847-bf54-92b65570870a',
  userRole: '11cadc3c-e833-4fdc-844b-f1c40f947543',
  salesRole: '85fcd9ad-c9f7-409e-85b8-57b7cc2ae5a6',
  adminModule: '3d1fbdb3-a863-4dfc-a426-3c9953e1bbbf',
  salesModule: 'c43cd32f-334d-4296-a72d-e3a08082f368',
  adminMenu: '8322bc38-3b81-4355-b9af-60045932a041',
  usersMenu: '32b8334c-1ad8-443a-bffa-d6558538614b',
  rolesMenu: '36af61c9-33ad-44ec-83cb-2589c57043aa',
  modulesMenu: '620a447e-63e0-4b1f-aede-adeccb68efc9',
  menusMenu: 'b76a24c8-620f-44e3-af3f-5226e343a6c6',
  extServicesMenu: 'ef6c1437-9347-4ba7-acdb-5b7911b3e446',
  salesMenu: '8936f02d-2418-4677-ab7e-9468c761282f',
  ordersMenu: '3c06bd5a-b838-4b39-9928-dc5f86a79806',
} as const;

// IDs de demo de generaciones anteriores. Sin esta limpieza, una base de datos
// ya sembrada conservaria los menus antiguos como huerfanos junto a los nuevos.
const LEGACY_MENU_IDS = [
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005',
  '99999999-9999-4999-8999-999999999999',
  'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  'aaaaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
  'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
];

async function cleanInvalidLegacyMenus() {
  await prisma.roleMenu.deleteMany({ where: { menuId: { in: LEGACY_MENU_IDS } } });
  await prisma.menu.deleteMany({ where: { id: { in: LEGACY_MENU_IDS } } });
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin12345!';
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? 'Demo12345!';
  const passwordHash = await argon2.hash(adminPassword, { type: argon2.argon2id });
  const demoPasswordHash = await argon2.hash(demoPassword, { type: argon2.argon2id });

  if (process.env.SEED_RESET === 'true') {
    await prisma.refreshToken.deleteMany();
    await prisma.roleMenu.deleteMany();
    await prisma.roleModule.deleteMany();
    await prisma.userRole.deleteMany();
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

  const adminRole = await prisma.role.upsert({ where: { name: 'ADMIN' }, update: { id: ids.adminRole, estado: Estado.ACTIVO }, create: { id: ids.adminRole, name: 'ADMIN', description: 'Administrador del Master Gateway' } });
  const userRole = await prisma.role.upsert({ where: { name: 'USER' }, update: { id: ids.userRole, estado: Estado.ACTIVO }, create: { id: ids.userRole, name: 'USER', description: 'Usuario estándar de consulta' } });
  const salesRole = await prisma.role.upsert({ where: { name: 'VENTAS' }, update: { id: ids.salesRole, estado: Estado.ACTIVO }, create: { id: ids.salesRole, name: 'VENTAS', description: 'Acceso al servicio de ventas' } });

  for (const [userId, roleId] of [[admin.id, adminRole.id], [demoUser.id, userRole.id], [salesUser.id, salesRole.id]] as const) {
    await prisma.userRole.upsert({ where: { userId_roleId: { userId, roleId } }, update: { estado: Estado.ACTIVO }, create: { userId, roleId, estado: Estado.ACTIVO, createdBy: admin.id } });
  }

  const adminModule = await prisma.systemModule.upsert({ where: { code: 'ADMIN' }, update: { id: ids.adminModule, estado: Estado.ACTIVO }, create: { id: ids.adminModule, code: 'ADMIN', name: 'Administración', description: 'Gestión de identidad, roles, módulos y menús', createdBy: admin.id } });
  const salesModule = await prisma.systemModule.upsert({ where: { code: 'VENTAS' }, update: { id: ids.salesModule, estado: Estado.ACTIVO }, create: { id: ids.salesModule, code: 'VENTAS', name: 'Ventas', description: 'Operación de pedidos y ventas', createdBy: admin.id } });

  for (const [roleId, moduleId] of [[adminRole.id, adminModule.id], [adminRole.id, salesModule.id], [salesRole.id, salesModule.id]] as const) {
    await prisma.roleModule.upsert({ where: { roleId_moduleId: { roleId, moduleId } }, update: { estado: Estado.ACTIVO }, create: { roleId, moduleId, estado: Estado.ACTIVO, createdBy: admin.id } });
  }

  const menus = [
    { id: ids.adminMenu, name: 'Administración', url: undefined, icon: 'settings', order: 0, moduleId: adminModule.id, parentId: undefined },
    { id: ids.usersMenu, name: 'Usuarios', url: '/app/users', icon: 'users', order: 1, moduleId: adminModule.id, parentId: ids.adminMenu },
    { id: ids.rolesMenu, name: 'Roles', url: '/app/roles', icon: 'shield', order: 2, moduleId: adminModule.id, parentId: ids.adminMenu },
    { id: ids.modulesMenu, name: 'Módulos', url: '/app/modules', icon: 'boxes', order: 3, moduleId: adminModule.id, parentId: ids.adminMenu },
    { id: ids.menusMenu, name: 'Menús', url: '/app/menus', icon: 'menu', order: 4, moduleId: adminModule.id, parentId: ids.adminMenu },
    { id: ids.extServicesMenu, name: 'Servicios externos', url: '/app/external-services', icon: 'plug', order: 5, moduleId: adminModule.id, parentId: ids.adminMenu },
    { id: ids.salesMenu, name: 'Ventas', url: '/app/sales', icon: 'shopping-cart', order: 1, moduleId: salesModule.id, parentId: undefined },
    { id: ids.ordersMenu, name: 'Pedidos', url: '/ventas/ordenes', icon: 'receipt', order: 2, moduleId: salesModule.id, parentId: ids.salesMenu },
  ];

  for (const menuData of menus) {
    const menu = await prisma.menu.upsert({ where: { id: menuData.id }, update: { ...menuData, estado: Estado.ACTIVO }, create: { ...menuData, estado: Estado.ACTIVO, createdBy: admin.id } });
    const roleIds = menuData.moduleId === salesModule.id ? [adminRole.id, salesRole.id] : [adminRole.id];
    for (const roleId of roleIds) {
      await prisma.roleMenu.upsert({ where: { roleId_menuId: { roleId, menuId: menu.id } }, update: { estado: Estado.ACTIVO }, create: { roleId, menuId: menu.id, estado: Estado.ACTIVO, createdBy: admin.id } });
    }
  }

  console.log(JSON.stringify({ message: 'Seed completado', users: [adminEmail, 'demo@example.com', 'ventas@example.com'], demoPassword, uuidVersion: 'v4' }, null, 2));
}

main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });