import { PrismaClient, Estado } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Todos los IDs fijos del catálogo demo son UUID v4 válidos.
const ids = {
  adminUser: '11111111-1111-4111-8111-111111111111',
  demoUser: '22222222-2222-4222-8222-222222222222',
  salesUser: '33333333-3333-4333-8333-333333333333',
  adminRole: '44444444-4444-4444-8444-444444444444',
  userRole: '55555555-5555-4555-8555-555555555555',
  salesRole: '66666666-6666-4666-8666-666666666666',
  adminModule: '77777777-7777-4777-8777-777777777777',
  salesModule: '88888888-8888-4888-8888-888888888888',
  adminMenu: '99999999-9999-4999-8999-999999999999',
  usersMenu: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  rolesMenu: 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  modulesMenu: 'aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  menusMenu: 'aaaaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
  salesMenu: 'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  ordersMenu: 'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
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