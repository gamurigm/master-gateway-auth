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
  superAdminUser: '68278593-4b6d-4c82-892c-3f733deaf863',
  adminUser: '3d5f0471-39fe-42b8-be26-bc6569492279',
  demoUser: 'dae15021-602e-493d-b5c3-23882e7c529c',
  salesUser: '87ef858a-1961-40b6-91f5-3a6871ae3ac4',
  superAdminRole: '27899f05-ee2d-4613-9f33-8c3beb37adad',
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

const CORE_SEED_NAME = 'core-security-v2';

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

const ADMIN_PERMISSION_MANAGER_CODES = new Set([
  'roles:assign_permission',
  'roles:unassign_permission',
]);

type SeedPermission = {
  id: string;
  code: string;
  resource: string;
  action: string;
  delegable: boolean;
};

type SeedUserData = {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  createdBy?: string;
};

type SeedRoleData = {
  id: string;
  name: string;
  description: string;
  createdBy: string;
};

type SeedModuleData = {
  id: string;
  code: string;
  name: string;
  description: string;
  createdBy: string;
};

async function ensureSeedUser(data: SeedUserData) {
  const existingById = await prisma.user.findUnique({ where: { id: data.id } });
  if (existingById) return existingById;

  const existingByEmail = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (existingByEmail) return existingByEmail;

  return prisma.user.create({ data });
}

async function ensureSeedRole(data: SeedRoleData) {
  const existingById = await prisma.role.findUnique({ where: { id: data.id } });
  if (existingById) return existingById;

  const existingByName = await prisma.role.findUnique({
    where: { name: data.name },
  });
  if (existingByName) return existingByName;

  return prisma.role.create({ data });
}

async function ensureSeedModule(data: SeedModuleData) {
  const existingById = await prisma.systemModule.findUnique({
    where: { id: data.id },
  });
  if (existingById) return existingById;

  const existingByCode = await prisma.systemModule.findUnique({
    where: { code: data.code },
  });
  if (existingByCode) return existingByCode;

  return prisma.systemModule.create({ data });
}

async function cleanInvalidLegacyMenus() {
  await prisma.roleMenu.deleteMany({
    where: { menuId: { in: LEGACY_MENU_IDS } },
  });
  await prisma.menu.deleteMany({ where: { id: { in: LEGACY_MENU_IDS } } });
}

function ensureDistinctSeedEmails(...emails: string[]) {
  const normalized = emails.map((email) => email.trim().toLowerCase());
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(
      'Los correos seed de SUPER_ADMIN, ADMIN, demo y ventas deben ser distintos',
    );
  }
}

/**
 * Recursos que administra el rol ADMIN.
 *
 * El catalogo de permisos en si (`permissions:write` / `permissions:delete`)
 * queda reservado a SUPER_ADMIN, igual que ya exigian los controladores con
 * `@RequireRoles('SUPER_ADMIN')`.
 */
const ADMIN_MANAGED_RESOURCES = new Set(['users', 'roles', 'modules', 'menus']);

/**
 * Que permisos recibe ADMIN.
 *
 * La regla anterior (`delegable && action !== 'delete'`) le negaba TODOS los
 * `*:delete`. Eso no reflejaba la realidad: los endpoints DELETE solo pedian
 * `@RequireRoles('ADMIN')`, asi que ADMIN si podia borrar. Ahora que los
 * permisos se aplican de verdad en el servidor (`PermissionsGuard`), esa
 * discrepancia habria dejado a ADMIN sin poder desactivar usuarios, roles,
 * modulos ni menus.
 *
 * Ademas el borrado ya NO es fisico en ninguna entidad, sino una desactivacion
 * logica (§9), que es una operacion administrativa normal.
 *
 * `delegable` sigue siendo un eje distinto: gobierna si ADMIN puede DELEGAR ese
 * permiso a otro rol, no si lo tiene (lo usan `roles.service` y la politica
 * rego).
 */
function canAdminReceiveSeedPermission(permission: SeedPermission) {
  if (ADMIN_PERMISSION_MANAGER_CODES.has(permission.code)) {
    return true;
  }

  if (permission.resource === 'permissions') {
    return permission.action === 'read';
  }

  return ADMIN_MANAGED_RESOURCES.has(permission.resource);
}

async function main() {
  const superAdminEmail =
    process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@example.com';
  const superAdminPassword =
    process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'SuperAdmin12345!';
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin12345!';
  const demoEmail = process.env.SEED_DEMO_EMAIL ?? 'demo@example.com';
  const salesEmail = process.env.SEED_SALES_EMAIL ?? 'ventas@example.com';
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? 'Demo12345!';

  ensureDistinctSeedEmails(superAdminEmail, adminEmail, demoEmail, salesEmail);

  const superAdminPasswordHash = await argon2.hash(superAdminPassword, {
    type: argon2.argon2id,
  });
  const adminPasswordHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
  });
  const demoPasswordHash = await argon2.hash(demoPassword, {
    type: argon2.argon2id,
  });

  const seedReset = process.env.SEED_RESET === 'true';

  if (seedReset) {
    await prisma.seedRun.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.roleMenu.deleteMany();
    await prisma.roleModule.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.menu.deleteMany();
    await prisma.systemModule.deleteMany();
    await prisma.role.deleteMany();
    await prisma.user.deleteMany();
    console.log('Base de datos limpiada por SEED_RESET=true');
  } else {
    const existingSeedRun = await prisma.seedRun.findUnique({
      where: { name: CORE_SEED_NAME },
    });

    if (existingSeedRun) {
      console.log(
        JSON.stringify(
          {
            message: 'Seed omitido: bootstrap ya aplicado',
            seed: CORE_SEED_NAME,
          },
          null,
          2,
        ),
      );
      return;
    }

    await cleanInvalidLegacyMenus();
  }

  const superAdmin = await ensureSeedUser({
    id: ids.superAdminUser,
    email: superAdminEmail,
    passwordHash: superAdminPasswordHash,
    firstName: 'Super',
    lastName: 'Admin',
  });
  const seedActorId = superAdmin.id;

  const admin = await ensureSeedUser({
    id: ids.adminUser,
    email: adminEmail,
    passwordHash: adminPasswordHash,
    firstName: 'Admin',
    lastName: 'Master',
    createdBy: seedActorId,
  });

  const demoUser = await ensureSeedUser({
    id: ids.demoUser,
    email: demoEmail,
    passwordHash: demoPasswordHash,
    firstName: 'Usuario',
    lastName: 'Demo',
    createdBy: seedActorId,
  });

  const salesUser = await ensureSeedUser({
    id: ids.salesUser,
    email: salesEmail,
    passwordHash: demoPasswordHash,
    firstName: 'Usuario',
    lastName: 'Ventas',
    createdBy: seedActorId,
  });

  const superAdminRole = await ensureSeedRole({
    id: ids.superAdminRole,
    name: 'SUPER_ADMIN',
    description: 'Super administrador con acceso total',
    createdBy: seedActorId,
  });
  const adminRole = await ensureSeedRole({
    id: ids.adminRole,
    name: 'ADMIN',
    description: 'Administrador del Master Gateway',
    createdBy: seedActorId,
  });
  const userRole = await ensureSeedRole({
    id: ids.userRole,
    name: 'USER',
    description: 'Usuario estandar de consulta',
    createdBy: seedActorId,
  });
  const salesRole = await ensureSeedRole({
    id: ids.salesRole,
    name: 'VENTAS',
    description: 'Acceso al servicio de ventas',
    createdBy: seedActorId,
  });

  for (const [userId, roleId] of [
    [superAdmin.id, superAdminRole.id],
    [admin.id, adminRole.id],
    [demoUser.id, userRole.id],
    [salesUser.id, salesRole.id],
  ] as const) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId, estado: Estado.ACTIVO, createdBy: seedActorId },
    });
  }

  await prisma.userRole.updateMany({
    where: {
      userId: admin.id,
      roleId: superAdminRole.id,
      estado: Estado.ACTIVO,
    },
    data: { estado: Estado.INACTIVO, updatedBy: seedActorId },
  });

  const adminModule = await ensureSeedModule({
    id: ids.adminModule,
    code: 'ADMIN',
    name: 'Administracion',
    description: 'Gestion de identidad, roles, modulos y menus',
    createdBy: seedActorId,
  });
  const salesModule = await ensureSeedModule({
    id: ids.salesModule,
    code: 'VENTAS',
    name: 'Ventas',
    description: 'Operacion de pedidos y ventas',
    createdBy: seedActorId,
  });

  for (const [roleId, moduleId] of [
    [superAdminRole.id, adminModule.id],
    [superAdminRole.id, salesModule.id],
    [adminRole.id, adminModule.id],
    [adminRole.id, salesModule.id],
    [salesRole.id, salesModule.id],
  ] as const) {
    await prisma.roleModule.upsert({
      where: { roleId_moduleId: { roleId, moduleId } },
      update: {},
      create: {
        roleId,
        moduleId,
        estado: Estado.ACTIVO,
        createdBy: seedActorId,
      },
    });
  }

  const menus = [
    {
      id: ids.adminMenu,
      name: 'Administracion',
      url: undefined,
      icon: 'settings',
      order: 0,
      moduleId: adminModule.id,
      parentId: undefined,
    },
    {
      id: ids.usersMenu,
      name: 'Usuarios',
      url: '/app/users',
      icon: 'users',
      order: 1,
      moduleId: adminModule.id,
      parentId: ids.adminMenu,
    },
    {
      id: ids.rolesMenu,
      name: 'Roles',
      url: '/app/roles',
      icon: 'shield',
      order: 2,
      moduleId: adminModule.id,
      parentId: ids.adminMenu,
    },
    {
      id: ids.modulesMenu,
      name: 'Modulos',
      url: '/app/modules',
      icon: 'boxes',
      order: 3,
      moduleId: adminModule.id,
      parentId: ids.adminMenu,
    },
    {
      id: ids.menusMenu,
      name: 'Menus',
      url: '/app/menus',
      icon: 'menu',
      order: 4,
      moduleId: adminModule.id,
      parentId: ids.adminMenu,
    },
    {
      id: ids.extServicesMenu,
      name: 'Servicios externos',
      url: '/app/external-services',
      icon: 'plug',
      order: 5,
      moduleId: adminModule.id,
      parentId: ids.adminMenu,
    },
    {
      id: ids.salesMenu,
      name: 'Ventas',
      url: '/app/sales',
      icon: 'shopping-cart',
      order: 1,
      moduleId: salesModule.id,
      parentId: undefined,
    },
    {
      id: ids.ordersMenu,
      name: 'Pedidos',
      url: '/ventas/ordenes',
      icon: 'receipt',
      order: 2,
      moduleId: salesModule.id,
      parentId: ids.salesMenu,
    },
  ];

  for (const menuData of menus) {
    const menu = await prisma.menu.upsert({
      where: { id: menuData.id },
      update: {},
      create: { ...menuData, estado: Estado.ACTIVO, createdBy: seedActorId },
    });
    const roleIds =
      menuData.moduleId === salesModule.id
        ? [superAdminRole.id, adminRole.id, salesRole.id]
        : [superAdminRole.id, adminRole.id];
    for (const roleId of roleIds) {
      await prisma.roleMenu.upsert({
        where: { roleId_menuId: { roleId, menuId: menu.id } },
        update: {},
        create: {
          roleId,
          menuId: menu.id,
          estado: Estado.ACTIVO,
          createdBy: seedActorId,
        },
      });
    }
  }

  const permissions = [
    {
      code: 'users:read',
      resource: 'users',
      action: 'read',
      description: 'Ver listado de usuarios',
      delegable: true,
    },
    {
      code: 'users:write',
      resource: 'users',
      action: 'write',
      description: 'Crear/editar usuarios',
      delegable: true,
    },
    {
      code: 'users:delete',
      resource: 'users',
      action: 'delete',
      // El borrado es LOGICO (estado -> INACTIVO), nunca fisico: lo exige el
      // §9 del enunciado. No delegable: ADMIN puede desactivar usuarios pero
      // no conceder esa capacidad a otros roles.
      description: 'Desactivar usuarios (eliminacion logica)',
      delegable: false,
    },
    {
      code: 'roles:read',
      resource: 'roles',
      action: 'read',
      description: 'Ver listado de roles',
      delegable: true,
    },
    {
      code: 'roles:create',
      resource: 'roles',
      action: 'create',
      description: 'Crear roles',
      delegable: true,
    },
    {
      code: 'roles:write',
      resource: 'roles',
      action: 'write',
      description: 'Editar roles',
      delegable: true,
    },
    {
      code: 'roles:delete',
      resource: 'roles',
      action: 'delete',
      description: 'Eliminar roles',
      delegable: false,
    },
    {
      code: 'roles:assign_user',
      resource: 'roles',
      action: 'assign_user',
      description: 'Asignar usuarios a roles',
      delegable: true,
    },
    {
      code: 'roles:unassign_user',
      resource: 'roles',
      action: 'unassign_user',
      description: 'Remover usuarios de roles',
      delegable: true,
    },
    {
      code: 'roles:assign_permission',
      resource: 'roles',
      action: 'assign_permission',
      description: 'Asignar permisos a roles',
      delegable: false,
    },
    {
      code: 'roles:unassign_permission',
      resource: 'roles',
      action: 'unassign_permission',
      description: 'Remover permisos de roles',
      delegable: false,
    },
    {
      code: 'modules:read',
      resource: 'modules',
      action: 'read',
      description: 'Ver modulos',
      delegable: true,
    },
    {
      code: 'modules:write',
      resource: 'modules',
      action: 'write',
      description: 'Crear/editar modulos',
      delegable: true,
    },
    {
      code: 'modules:delete',
      resource: 'modules',
      action: 'delete',
      description: 'Eliminar modulos',
      delegable: false,
    },
    {
      code: 'menus:read',
      resource: 'menus',
      action: 'read',
      description: 'Ver menus',
      delegable: true,
    },
    {
      code: 'menus:write',
      resource: 'menus',
      action: 'write',
      description: 'Crear/editar menus',
      delegable: true,
    },
    {
      code: 'menus:delete',
      resource: 'menus',
      action: 'delete',
      description: 'Eliminar menus',
      delegable: false,
    },
    {
      code: 'permissions:read',
      resource: 'permissions',
      action: 'read',
      description: 'Ver permisos',
      delegable: true,
    },
    {
      code: 'permissions:write',
      resource: 'permissions',
      action: 'write',
      description: 'Crear/editar permisos',
      delegable: false,
    },
    {
      code: 'permissions:delete',
      resource: 'permissions',
      action: 'delete',
      description: 'Eliminar permisos',
      delegable: false,
    },
  ];

  const createdPermissions: SeedPermission[] = [];
  for (const p of permissions) {
    const perm = await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: { ...p, estado: Estado.ACTIVO, createdBy: seedActorId },
    });
    createdPermissions.push(perm);
  }

  const disallowedAdminPermissionIds = createdPermissions
    .filter((permission) => !canAdminReceiveSeedPermission(permission))
    .map((permission) => permission.id);

  for (const perm of createdPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdminRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: superAdminRole.id,
        permissionId: perm.id,
        estado: Estado.ACTIVO,
        createdBy: seedActorId,
      },
    });

    if (canAdminReceiveSeedPermission(perm)) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id },
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: perm.id,
          estado: Estado.ACTIVO,
          createdBy: seedActorId,
        },
      });
    }
  }

  if (disallowedAdminPermissionIds.length > 0) {
    await prisma.rolePermission.updateMany({
      where: {
        roleId: adminRole.id,
        permissionId: { in: disallowedAdminPermissionIds },
        estado: Estado.ACTIVO,
      },
      data: { estado: Estado.INACTIVO, updatedBy: seedActorId },
    });
  }

  await prisma.seedRun.upsert({
    where: { name: CORE_SEED_NAME },
    update: {},
    create: { name: CORE_SEED_NAME },
  });

  console.log(
    JSON.stringify(
      {
        message: 'Seed completado',
        users: [superAdminEmail, adminEmail, demoEmail, salesEmail],
        demoPassword,
        uuidVersion: 'v4',
        permissions: createdPermissions.length,
      },
      null,
      2,
    ),
  );
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
