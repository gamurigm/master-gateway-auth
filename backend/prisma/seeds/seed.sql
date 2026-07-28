-- =====================================================================
-- Seed SQL del Master Gateway
-- =====================================================================
--
-- Equivalente en SQL puro de `backend/prisma/seed.ts`. Ambos usan EXACTAMENTE
-- los mismos identificadores, de modo que ejecutar uno u otro converge al
-- mismo estado de bootstrap.
--
-- Es idempotente y no reactiva registros inactivados por la aplicacion. Si un
-- usuario borra logicamente modulos, menus, roles o asignaciones desde la UI,
-- un nuevo arranque no debe volver a marcarlos como ACTIVO.
--
-- Uso:
--   psql "$DATABASE_URL" -f backend/prisma/seeds/seed.sql
--   npm run prisma:seed:sql
--
-- NOTA SOBRE LAS CONTRASENAS
-- Los hashes argon2id corresponden a credenciales de DEMO documentadas en el
-- README (SuperAdmin12345! / Admin12345! / Demo12345!). En despliegues reales
-- se usan variables de entorno, nunca valores demo.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "_seed_runs" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "_seed_runs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "_seed_runs_nombre_key" ON "_seed_runs"("nombre");

SELECT EXISTS (SELECT 1 FROM "_seed_runs" WHERE "nombre" = 'core-security-v2') AS seed_done \gset
\if :seed_done
\echo 'Seed omitido: bootstrap ya aplicado'
COMMIT;
\quit
\endif

-- ---------------------------------------------------------------------
-- Limpieza de los IDs de demo antiguos que seguian un patron fijo.
-- ---------------------------------------------------------------------
DELETE FROM "rol_menus" WHERE "menu_id" IN (
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000005',
    '99999999-9999-4999-8999-999999999999', 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    'aaaaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
);
DELETE FROM "menus" WHERE "id" IN (
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000005',
    '99999999-9999-4999-8999-999999999999', 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    'aaaaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
);

-- ---------------------------------------------------------------------
-- USUARIOS
-- ---------------------------------------------------------------------
INSERT INTO "usuarios" ("id", "email", "password_hash", "nombres", "apellidos", "estado", "fecha_creacion", "fecha_actualizacion")
VALUES
    ('68278593-4b6d-4c82-892c-3f733deaf863', 'superadmin@example.com',
     '$argon2id$v=19$m=65536,t=3,p=4$ie0bA4uOYiNIixeOkdcl2w$qaEvmLTbnb0Vl652GFMnjkgsUbwapRfQCVHgMP2+5Uo',
     'Super', 'Admin', 'ACTIVO', now(), now()),
    ('3d5f0471-39fe-42b8-be26-bc6569492279', 'admin@example.com',
     '$argon2id$v=19$m=65536,t=3,p=4$ARoa/UNPG3hjtegs1rfOsQ$iDzdL8q1wVedLzJ4va1EuRFiqS+F/HNoqlx2wyDb4l8',
     'Admin', 'Master', 'ACTIVO', now(), now()),
    ('dae15021-602e-493d-b5c3-23882e7c529c', 'demo@example.com',
     '$argon2id$v=19$m=65536,t=3,p=4$QOJgIBoR89ojGYSZb2UOFg$XY4ptmSvL/14MIT2nT7lc8h+wveBIFqS5pMoX136f+Q',
     'Usuario', 'Demo', 'ACTIVO', now(), now()),
    ('87ef858a-1961-40b6-91f5-3a6871ae3ac4', 'ventas@example.com',
     '$argon2id$v=19$m=65536,t=3,p=4$QOJgIBoR89ojGYSZb2UOFg$XY4ptmSvL/14MIT2nT7lc8h+wveBIFqS5pMoX136f+Q',
     'Usuario', 'Ventas', 'ACTIVO', now(), now())
ON CONFLICT ("id") DO NOTHING;

-- ---------------------------------------------------------------------
-- ROLES
-- ---------------------------------------------------------------------
INSERT INTO "roles" ("id", "nombre", "descripcion", "estado", "fecha_creacion", "fecha_actualizacion", "creado_por")
VALUES
    ('27899f05-ee2d-4613-9f33-8c3beb37adad', 'SUPER_ADMIN', 'Super administrador con acceso total', 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    ('bed7be1f-4d90-4847-bf54-92b65570870a', 'ADMIN',  'Administrador del Master Gateway', 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    ('11cadc3c-e833-4fdc-844b-f1c40f947543', 'USER',   'Usuario estandar de consulta',     'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    ('85fcd9ad-c9f7-409e-85b8-57b7cc2ae5a6', 'VENTAS', 'Acceso al servicio de ventas',     'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863')
ON CONFLICT ("id") DO NOTHING;

-- ---------------------------------------------------------------------
-- MODULOS
-- ---------------------------------------------------------------------
INSERT INTO "modulos" ("id", "codigo", "nombre", "descripcion", "estado", "fecha_creacion", "fecha_actualizacion", "creado_por")
VALUES
    ('3d1fbdb3-a863-4dfc-a426-3c9953e1bbbf', 'ADMIN',  'Administracion', 'Gestion de identidad, roles, modulos y menus', 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    ('c43cd32f-334d-4296-a72d-e3a08082f368', 'VENTAS', 'Ventas',         'Operacion de pedidos y ventas',                'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863')
ON CONFLICT ("id") DO NOTHING;

-- ---------------------------------------------------------------------
-- USUARIO_ROLES
-- Cada correo demo queda con su rol propio. El admin ya no recibe SUPER_ADMIN.
-- ---------------------------------------------------------------------
INSERT INTO "usuario_roles" ("id", "usuario_id", "rol_id", "estado", "fecha_creacion", "fecha_actualizacion", "creado_por")
VALUES
    (gen_random_uuid(), '68278593-4b6d-4c82-892c-3f733deaf863', '27899f05-ee2d-4613-9f33-8c3beb37adad', 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), '3d5f0471-39fe-42b8-be26-bc6569492279', 'bed7be1f-4d90-4847-bf54-92b65570870a', 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), 'dae15021-602e-493d-b5c3-23882e7c529c', '11cadc3c-e833-4fdc-844b-f1c40f947543', 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), '87ef858a-1961-40b6-91f5-3a6871ae3ac4', '85fcd9ad-c9f7-409e-85b8-57b7cc2ae5a6', 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863')
ON CONFLICT ("usuario_id", "rol_id") DO UPDATE SET
    "fecha_actualizacion" = now();

UPDATE "usuario_roles"
SET "estado" = 'INACTIVO', "fecha_actualizacion" = now(), "actualizado_por" = '68278593-4b6d-4c82-892c-3f733deaf863'
WHERE "usuario_id" = '3d5f0471-39fe-42b8-be26-bc6569492279'
  AND "rol_id" = '27899f05-ee2d-4613-9f33-8c3beb37adad'
  AND "estado" = 'ACTIVO';

-- ---------------------------------------------------------------------
-- ROL_MODULOS
-- ---------------------------------------------------------------------
INSERT INTO "rol_modulos" ("id", "rol_id", "modulo_id", "estado", "fecha_creacion", "fecha_actualizacion", "creado_por")
VALUES
    (gen_random_uuid(), '27899f05-ee2d-4613-9f33-8c3beb37adad', '3d1fbdb3-a863-4dfc-a426-3c9953e1bbbf', 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), '27899f05-ee2d-4613-9f33-8c3beb37adad', 'c43cd32f-334d-4296-a72d-e3a08082f368', 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), 'bed7be1f-4d90-4847-bf54-92b65570870a', '3d1fbdb3-a863-4dfc-a426-3c9953e1bbbf', 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), 'bed7be1f-4d90-4847-bf54-92b65570870a', 'c43cd32f-334d-4296-a72d-e3a08082f368', 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), '85fcd9ad-c9f7-409e-85b8-57b7cc2ae5a6', 'c43cd32f-334d-4296-a72d-e3a08082f368', 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863')
ON CONFLICT ("rol_id", "modulo_id") DO UPDATE SET
    "fecha_actualizacion" = now();

-- ---------------------------------------------------------------------
-- MENUS
-- ---------------------------------------------------------------------
INSERT INTO "menus" ("id", "nombre", "url", "icono", "orden", "modulo_id", "parent_id", "estado", "fecha_creacion", "fecha_actualizacion", "creado_por")
VALUES
    ('8322bc38-3b81-4355-b9af-60045932a041', 'Administracion',        NULL,                     'settings',      0, '3d1fbdb3-a863-4dfc-a426-3c9953e1bbbf', NULL,                                   'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    ('32b8334c-1ad8-443a-bffa-d6558538614b', 'Usuarios',              '/app/users',             'users',         1, '3d1fbdb3-a863-4dfc-a426-3c9953e1bbbf', '8322bc38-3b81-4355-b9af-60045932a041', 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    ('36af61c9-33ad-44ec-83cb-2589c57043aa', 'Roles',                 '/app/roles',             'shield',        2, '3d1fbdb3-a863-4dfc-a426-3c9953e1bbbf', '8322bc38-3b81-4355-b9af-60045932a041', 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    ('620a447e-63e0-4b1f-aede-adeccb68efc9', 'Modulos',               '/app/modules',           'boxes',         3, '3d1fbdb3-a863-4dfc-a426-3c9953e1bbbf', '8322bc38-3b81-4355-b9af-60045932a041', 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    ('b76a24c8-620f-44e3-af3f-5226e343a6c6', 'Menus',                 '/app/menus',             'menu',          4, '3d1fbdb3-a863-4dfc-a426-3c9953e1bbbf', '8322bc38-3b81-4355-b9af-60045932a041', 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    ('ef6c1437-9347-4ba7-acdb-5b7911b3e446', 'Servicios externos',    '/app/external-services', 'plug',          5, '3d1fbdb3-a863-4dfc-a426-3c9953e1bbbf', '8322bc38-3b81-4355-b9af-60045932a041', 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    ('8936f02d-2418-4677-ab7e-9468c761282f', 'Ventas',                '/app/sales',             'shopping-cart', 1, 'c43cd32f-334d-4296-a72d-e3a08082f368', NULL,                                   'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    ('3c06bd5a-b838-4b39-9928-dc5f86a79806', 'Pedidos',               '/ventas/ordenes',        'receipt',       2, 'c43cd32f-334d-4296-a72d-e3a08082f368', '8936f02d-2418-4677-ab7e-9468c761282f', 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863')
ON CONFLICT ("id") DO NOTHING;

-- ---------------------------------------------------------------------
-- ROL_MENUS
-- SUPER_ADMIN y ADMIN ven todo; VENTAS solo los menus del modulo de Ventas.
-- ---------------------------------------------------------------------
INSERT INTO "rol_menus" ("id", "rol_id", "menu_id", "estado", "fecha_creacion", "fecha_actualizacion", "creado_por")
SELECT gen_random_uuid(), '27899f05-ee2d-4613-9f33-8c3beb37adad', m."id", 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'
FROM "menus" m
WHERE m."modulo_id" IN ('3d1fbdb3-a863-4dfc-a426-3c9953e1bbbf', 'c43cd32f-334d-4296-a72d-e3a08082f368')
ON CONFLICT ("rol_id", "menu_id") DO UPDATE SET
    "fecha_actualizacion" = now();

INSERT INTO "rol_menus" ("id", "rol_id", "menu_id", "estado", "fecha_creacion", "fecha_actualizacion", "creado_por")
SELECT gen_random_uuid(), 'bed7be1f-4d90-4847-bf54-92b65570870a', m."id", 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'
FROM "menus" m
WHERE m."modulo_id" IN ('3d1fbdb3-a863-4dfc-a426-3c9953e1bbbf', 'c43cd32f-334d-4296-a72d-e3a08082f368')
ON CONFLICT ("rol_id", "menu_id") DO UPDATE SET
    "fecha_actualizacion" = now();

INSERT INTO "rol_menus" ("id", "rol_id", "menu_id", "estado", "fecha_creacion", "fecha_actualizacion", "creado_por")
SELECT gen_random_uuid(), '85fcd9ad-c9f7-409e-85b8-57b7cc2ae5a6', m."id", 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'
FROM "menus" m
WHERE m."modulo_id" = 'c43cd32f-334d-4296-a72d-e3a08082f368'
ON CONFLICT ("rol_id", "menu_id") DO UPDATE SET
    "fecha_actualizacion" = now();

-- ---------------------------------------------------------------------
-- PERMISOS
-- ---------------------------------------------------------------------
INSERT INTO "permisos" ("id", "codigo", "recurso", "accion", "descripcion", "delegable", "estado", "fecha_creacion", "fecha_actualizacion", "creado_por")
VALUES
    (gen_random_uuid(), 'users:read', 'users', 'read', 'Ver listado de usuarios', true, 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), 'users:write', 'users', 'write', 'Crear/editar usuarios', true, 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), 'users:delete', 'users', 'delete', 'Eliminar fisicamente usuarios', false, 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), 'roles:read', 'roles', 'read', 'Ver listado de roles', true, 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), 'roles:create', 'roles', 'create', 'Crear roles', true, 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), 'roles:write', 'roles', 'write', 'Editar roles', true, 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), 'roles:delete', 'roles', 'delete', 'Eliminar roles', false, 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), 'roles:assign_user', 'roles', 'assign_user', 'Asignar usuarios a roles', true, 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), 'roles:unassign_user', 'roles', 'unassign_user', 'Remover usuarios de roles', true, 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), 'roles:assign_permission', 'roles', 'assign_permission', 'Asignar permisos a roles', false, 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), 'roles:unassign_permission', 'roles', 'unassign_permission', 'Remover permisos de roles', false, 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), 'modules:read', 'modules', 'read', 'Ver modulos', true, 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), 'modules:write', 'modules', 'write', 'Crear/editar modulos', true, 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), 'modules:delete', 'modules', 'delete', 'Eliminar modulos', false, 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), 'menus:read', 'menus', 'read', 'Ver menus', true, 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), 'menus:write', 'menus', 'write', 'Crear/editar menus', true, 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), 'menus:delete', 'menus', 'delete', 'Eliminar menus', false, 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), 'permissions:read', 'permissions', 'read', 'Ver permisos', true, 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), 'permissions:write', 'permissions', 'write', 'Crear/editar permisos', false, 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'),
    (gen_random_uuid(), 'permissions:delete', 'permissions', 'delete', 'Eliminar permisos', false, 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863')
ON CONFLICT ("codigo") DO NOTHING;

INSERT INTO "rol_permisos" ("id", "rol_id", "permiso_id", "estado", "fecha_creacion", "fecha_actualizacion", "creado_por")
SELECT gen_random_uuid(), '27899f05-ee2d-4613-9f33-8c3beb37adad', p."id", 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'
FROM "permisos" p
ON CONFLICT ("rol_id", "permiso_id") DO UPDATE SET
    "fecha_actualizacion" = now();

INSERT INTO "rol_permisos" ("id", "rol_id", "permiso_id", "estado", "fecha_creacion", "fecha_actualizacion", "creado_por")
SELECT gen_random_uuid(), 'bed7be1f-4d90-4847-bf54-92b65570870a', p."id", 'ACTIVO', now(), now(), '68278593-4b6d-4c82-892c-3f733deaf863'
FROM "permisos" p
WHERE p."codigo" IN (
    'users:read', 'users:write',
    'roles:read', 'roles:create', 'roles:write', 'roles:assign_user', 'roles:unassign_user', 'roles:assign_permission', 'roles:unassign_permission',
    'modules:read', 'modules:write',
    'menus:read', 'menus:write',
    'permissions:read'
)
ON CONFLICT ("rol_id", "permiso_id") DO UPDATE SET
    "fecha_actualizacion" = now();

UPDATE "rol_permisos" rp
SET "estado" = 'INACTIVO', "fecha_actualizacion" = now(), "actualizado_por" = '68278593-4b6d-4c82-892c-3f733deaf863'
FROM "permisos" p
WHERE rp."permiso_id" = p."id"
  AND rp."rol_id" = 'bed7be1f-4d90-4847-bf54-92b65570870a'
  AND rp."estado" = 'ACTIVO'
  AND p."codigo" IN ('users:delete', 'roles:delete', 'modules:delete', 'menus:delete', 'permissions:write', 'permissions:delete');

INSERT INTO "_seed_runs" ("id", "nombre", "fecha_creacion", "fecha_actualizacion")
VALUES (gen_random_uuid(), 'core-security-v2', now(), now())
ON CONFLICT ("nombre") DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------
-- Verificacion rapida
-- ---------------------------------------------------------------------
-- SELECT 'usuarios' t, count(*) FROM "usuarios"
-- UNION ALL SELECT 'roles',        count(*) FROM "roles"
-- UNION ALL SELECT 'modulos',      count(*) FROM "modulos"
-- UNION ALL SELECT 'menus',        count(*) FROM "menus"
-- UNION ALL SELECT 'rol_menus',    count(*) FROM "rol_menus";