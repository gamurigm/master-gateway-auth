import { PrismaClient, Estado } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin12345!';
  const passwordHash = await argon2.hash(adminPassword, { type: argon2.argon2id });

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      estado: Estado.ACTIVO,
      passwordHash,
      firstName: 'Admin',
      lastName: 'Master',
    },
    create: {
      email: adminEmail,
      passwordHash,
      firstName: 'Admin',
      lastName: 'Master',
    },
  });

  const role = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: { estado: Estado.ACTIVO },
    create: {
      name: 'ADMIN',
      description: 'Administrador del Master Gateway',
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: role.id } },
    update: { estado: Estado.ACTIVO },
    create: { userId: admin.id, roleId: role.id, createdBy: admin.id },
  });

  const adminModule = await prisma.systemModule.upsert({
    where: { code: 'ADMIN' },
    update: { estado: Estado.ACTIVO },
    create: {
      code: 'ADMIN',
      name: 'Administracion',
      description: 'Gestion de identidad, roles, modulos y menus',
      createdBy: admin.id,
    },
  });

  await prisma.roleModule.upsert({
    where: { roleId_moduleId: { roleId: role.id, moduleId: adminModule.id } },
    update: { estado: Estado.ACTIVO },
    create: { roleId: role.id, moduleId: adminModule.id, createdBy: admin.id },
  });

  const rootMenu = await prisma.menu.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: { estado: Estado.ACTIVO },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Administracion',
      icon: 'settings',
      moduleId: adminModule.id,
      createdBy: admin.id,
    },
  });

  const menuItems = [
    ['00000000-0000-0000-0000-000000000002', 'Usuarios', '/app/users', 1],
    ['00000000-0000-0000-0000-000000000003', 'Roles', '/app/roles', 2],
    ['00000000-0000-0000-0000-000000000004', 'Modulos', '/app/modules', 3],
    ['00000000-0000-0000-0000-000000000005', 'Menus', '/app/menus', 4],
  ] as const;

  await prisma.roleMenu.upsert({
    where: { roleId_menuId: { roleId: role.id, menuId: rootMenu.id } },
    update: { estado: Estado.ACTIVO },
    create: { roleId: role.id, menuId: rootMenu.id, createdBy: admin.id },
  });

  for (const [id, name, url, order] of menuItems) {
    const menu = await prisma.menu.upsert({
      where: { id },
      update: { estado: Estado.ACTIVO, name, url, order },
      create: {
        id,
        name,
        url,
        order,
        moduleId: adminModule.id,
        parentId: rootMenu.id,
        createdBy: admin.id,
      },
    });

    await prisma.roleMenu.upsert({
      where: { roleId_menuId: { roleId: role.id, menuId: menu.id } },
      update: { estado: Estado.ACTIVO },
      create: { roleId: role.id, menuId: menu.id, createdBy: admin.id },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
