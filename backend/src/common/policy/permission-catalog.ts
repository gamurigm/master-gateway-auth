export const SYSTEM_ROLES = {
  SUPERADMIN: 'SUPERADMIN',
  ADMIN: 'ADMIN',
  INVITADO: 'INVITADO',
} as const;

export type SystemRoleName = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

export type PermissionDefinition = {
  code: string;
  resource: string;
  action: string;
  description: string;
  delegable: boolean;
};

const crudPermissions = (resource: string, label: string) =>
  [
    {
      code: `${resource}:read`,
      resource,
      action: 'read',
      description: `Consultar ${label}`,
      delegable: true,
    },
    {
      code: `${resource}:create`,
      resource,
      action: 'create',
      description: `Crear ${label}`,
      delegable: true,
    },
    {
      code: `${resource}:update`,
      resource,
      action: 'update',
      description: `Actualizar ${label}`,
      delegable: true,
    },
    {
      code: `${resource}:delete_soft`,
      resource,
      action: 'delete_soft',
      description: `Inactivar ${label}`,
      delegable: true,
    },
    {
      code: `${resource}:delete_hard`,
      resource,
      action: 'delete_hard',
      description: `Eliminar fisicamente ${label}`,
      delegable: false,
    },
  ] satisfies PermissionDefinition[];

export const PERMISSIONS = [
  ...crudPermissions('users', 'usuarios'),
  ...crudPermissions('roles', 'roles'),
  ...crudPermissions('modules', 'modulos'),
  ...crudPermissions('menus', 'menus'),
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
    description: 'Desasignar usuarios de roles',
    delegable: true,
  },
  {
    code: 'roles:assign_module',
    resource: 'roles',
    action: 'assign_module',
    description: 'Asignar modulos a roles',
    delegable: true,
  },
  {
    code: 'roles:unassign_module',
    resource: 'roles',
    action: 'unassign_module',
    description: 'Desasignar modulos de roles',
    delegable: true,
  },
  {
    code: 'roles:assign_menu',
    resource: 'roles',
    action: 'assign_menu',
    description: 'Asignar menus a roles',
    delegable: true,
  },
  {
    code: 'roles:unassign_menu',
    resource: 'roles',
    action: 'unassign_menu',
    description: 'Desasignar menus de roles',
    delegable: true,
  },
  {
    code: 'roles:assign_permission',
    resource: 'roles',
    action: 'assign_permission',
    description: 'Asignar permisos a roles',
    delegable: true,
  },
  {
    code: 'roles:unassign_permission',
    resource: 'roles',
    action: 'unassign_permission',
    description: 'Desasignar permisos de roles',
    delegable: true,
  },
  {
    code: 'permissions:read',
    resource: 'permissions',
    action: 'read',
    description: 'Consultar catalogo de permisos',
    delegable: true,
  },
  {
    code: 'inventory:read',
    resource: 'inventory',
    action: 'read',
    description: 'Consultar inventario',
    delegable: true,
  },
  {
    code: 'sales:read',
    resource: 'sales',
    action: 'read',
    description: 'Consultar ventas',
    delegable: true,
  },
] satisfies PermissionDefinition[];

export const ALL_PERMISSION_CODES = PERMISSIONS.map(
  (permission) => permission.code,
);

export const ADMIN_PERMISSION_CODES = PERMISSIONS.filter(
  (permission) => permission.action !== 'delete_hard',
).map((permission) => permission.code);

export const GUEST_PERMISSION_CODES = PERMISSIONS.filter(
  (permission) => permission.action === 'read',
).map((permission) => permission.code);

export const HARD_DELETE_ACTION = 'delete_hard';
