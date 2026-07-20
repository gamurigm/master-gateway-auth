-- =====================================================================
-- Seed SQL del Master Gateway
-- =====================================================================
--
-- Equivalente en SQL puro de `backend/prisma/seed.ts`. Ambos usan EXACTAMENTE
-- los mismos identificadores, de modo que ejecutar uno u otro (o los dos)
-- converge al mismo estado.
--
-- Todos los IDs son UUID v4 generados aleatoriamente con crypto.randomUUID().
-- No siguen ningun patron: se descartaron los antiguos 11111111-1111-4111-...
-- porque, aunque sintacticamente validos, no eran aleatorios.
--
-- Es idempotente: cada INSERT lleva ON CONFLICT DO UPDATE, asi que puede
-- ejecutarse tantas veces como haga falta.
--
-- Uso:
--   psql "$DATABASE_URL" -f backend/prisma/seeds/seed.sql
--   npm run prisma:seed:sql
--
-- Requiere que las migraciones ya esten aplicadas (npm run prisma:migrate).
--
-- NOTA SOBRE LAS CONTRASENAS
-- Los hashes argon2id de abajo corresponden a las credenciales de DEMO
-- documentadas en el README (Admin12345! / Demo12345!). Son datos de ejemplo
-- para desarrollo local: en un despliegue real el administrador se crea con
-- SEED_ADMIN_PASSWORD desde el entorno, nunca con este archivo.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Limpieza de los IDs de demo antiguos que seguian un patron fijo.
-- Sin esto, una base de datos ya sembrada conservaria menus huerfanos.
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
    ('3d5f0471-39fe-42b8-be26-bc6569492279', 'admin@example.com',
     '$argon2id$v=19$m=65536,t=3,p=4$ARoa/UNPG3hjtegs1rfOsQ$iDzdL8q1wVedLzJ4va1EuRFiqS+F/HNoqlx2wyDb4l8',
     'Admin', 'Master', 'ACTIVO', now(), now()),
    ('dae15021-602e-493d-b5c3-23882e7c529c', 'demo@example.com',
     '$argon2id$v=19$m=65536,t=3,p=4$QOJgIBoR89ojGYSZb2UOFg$XY4ptmSvL/14MIT2nT7lc8h+wveBIFqS5pMoX136f+Q',
     'Usuario', 'Demo', 'ACTIVO', now(), now()),
    ('87ef858a-1961-40b6-91f5-3a6871ae3ac4', 'ventas@example.com',
     '$argon2id$v=19$m=65536,t=3,p=4$QOJgIBoR89ojGYSZb2UOFg$XY4ptmSvL/14MIT2nT7lc8h+wveBIFqS5pMoX136f+Q',
     'Usuario', 'Ventas', 'ACTIVO', now(), now())
ON CONFLICT ("email") DO UPDATE SET
    "estado" = 'ACTIVO',
    "nombres" = EXCLUDED."nombres",
    "apellidos" = EXCLUDED."apellidos",
    "fecha_actualizacion" = now();

-- ---------------------------------------------------------------------
-- ROLES
-- ---------------------------------------------------------------------
INSERT INTO "roles" ("id", "nombre", "descripcion", "estado", "fecha_creacion", "fecha_actualizacion", "creado_por")
VALUES
    ('bed7be1f-4d90-4847-bf54-92b65570870a', 'ADMIN',  'Administrador del Master Gateway', 'ACTIVO', now(), now(), '3d5f0471-39fe-42b8-be26-bc6569492279'),
    ('11cadc3c-e833-4fdc-844b-f1c40f947543', 'USER',   'Usuario estandar de consulta',     'ACTIVO', now(), now(), '3d5f0471-39fe-42b8-be26-bc6569492279'),
    ('85fcd9ad-c9f7-409e-85b8-57b7cc2ae5a6', 'VENTAS', 'Acceso al servicio de ventas',     'ACTIVO', now(), now(), '3d5f0471-39fe-42b8-be26-bc6569492279')
ON CONFLICT ("nombre") DO UPDATE SET
    "estado" = 'ACTIVO',
    "descripcion" = EXCLUDED."descripcion",
    "fecha_actualizacion" = now();

-- ---------------------------------------------------------------------
-- MODULOS
-- ---------------------------------------------------------------------
INSERT INTO "modulos" ("id", "codigo", "nombre", "descripcion", "estado", "fecha_creacion", "fecha_actualizacion", "creado_por")
VALUES
    ('3d1fbdb3-a863-4dfc-a426-3c9953e1bbbf', 'ADMIN',  'Administracion', 'Gestion de identidad, roles, modulos y menus', 'ACTIVO', now(), now(), '3d5f0471-39fe-42b8-be26-bc6569492279'),
    ('c43cd32f-334d-4296-a72d-e3a08082f368', 'VENTAS', 'Ventas',         'Operacion de pedidos y ventas',                'ACTIVO', now(), now(), '3d5f0471-39fe-42b8-be26-bc6569492279')
ON CONFLICT ("codigo") DO UPDATE SET
    "estado" = 'ACTIVO',
    "nombre" = EXCLUDED."nombre",
    "descripcion" = EXCLUDED."descripcion",
    "fecha_actualizacion" = now();

-- ---------------------------------------------------------------------
-- USUARIO_ROLES (tabla pivote M:N)
-- El PDF insiste en que la pivote "no es una tabla tonta": hereda los mismos
-- campos de auditoria, para saber cuando se otorgo o revoco cada permiso.
-- ---------------------------------------------------------------------
INSERT INTO "usuario_roles" ("id", "usuario_id", "rol_id", "estado", "fecha_creacion", "fecha_actualizacion", "creado_por")
VALUES
    (gen_random_uuid(), '3d5f0471-39fe-42b8-be26-bc6569492279', 'bed7be1f-4d90-4847-bf54-92b65570870a', 'ACTIVO', now(), now(), '3d5f0471-39fe-42b8-be26-bc6569492279'),
    (gen_random_uuid(), 'dae15021-602e-493d-b5c3-23882e7c529c', '11cadc3c-e833-4fdc-844b-f1c40f947543', 'ACTIVO', now(), now(), '3d5f0471-39fe-42b8-be26-bc6569492279'),
    (gen_random_uuid(), '87ef858a-1961-40b6-91f5-3a6871ae3ac4', '85fcd9ad-c9f7-409e-85b8-57b7cc2ae5a6', 'ACTIVO', now(), now(), '3d5f0471-39fe-42b8-be26-bc6569492279')
ON CONFLICT ("usuario_id", "rol_id") DO UPDATE SET
    "estado" = 'ACTIVO',
    "fecha_actualizacion" = now();

-- ---------------------------------------------------------------------
-- ROL_MODULOS
-- ---------------------------------------------------------------------
INSERT INTO "rol_modulos" ("id", "rol_id", "modulo_id", "estado", "fecha_creacion", "fecha_actualizacion", "creado_por")
VALUES
    (gen_random_uuid(), 'bed7be1f-4d90-4847-bf54-92b65570870a', '3d1fbdb3-a863-4dfc-a426-3c9953e1bbbf', 'ACTIVO', now(), now(), '3d5f0471-39fe-42b8-be26-bc6569492279'),
    (gen_random_uuid(), 'bed7be1f-4d90-4847-bf54-92b65570870a', 'c43cd32f-334d-4296-a72d-e3a08082f368', 'ACTIVO', now(), now(), '3d5f0471-39fe-42b8-be26-bc6569492279'),
    (gen_random_uuid(), '85fcd9ad-c9f7-409e-85b8-57b7cc2ae5a6', 'c43cd32f-334d-4296-a72d-e3a08082f368', 'ACTIVO', now(), now(), '3d5f0471-39fe-42b8-be26-bc6569492279')
ON CONFLICT ("rol_id", "modulo_id") DO UPDATE SET
    "estado" = 'ACTIVO',
    "fecha_actualizacion" = now();

-- ---------------------------------------------------------------------
-- MENUS (Adjacency List: parent_id apunta a otro registro de esta tabla)
-- Solo los nodos hoja llevan url; los intermedios agrupan.
-- El orden de insercion respeta la jerarquia: primero las raices.
-- ---------------------------------------------------------------------
INSERT INTO "menus" ("id", "nombre", "url", "icono", "orden", "modulo_id", "parent_id", "estado", "fecha_creacion", "fecha_actualizacion", "creado_por")
VALUES
    -- Raiz del modulo de Administracion (sin url: es agrupador)
    ('8322bc38-3b81-4355-b9af-60045932a041', 'Administracion',        NULL,                     'settings',      0, '3d1fbdb3-a863-4dfc-a426-3c9953e1bbbf', NULL,                                   'ACTIVO', now(), now(), '3d5f0471-39fe-42b8-be26-bc6569492279'),
    ('32b8334c-1ad8-443a-bffa-d6558538614b', 'Usuarios',              '/app/users',             'users',         1, '3d1fbdb3-a863-4dfc-a426-3c9953e1bbbf', '8322bc38-3b81-4355-b9af-60045932a041', 'ACTIVO', now(), now(), '3d5f0471-39fe-42b8-be26-bc6569492279'),
    ('36af61c9-33ad-44ec-83cb-2589c57043aa', 'Roles',                 '/app/roles',             'shield',        2, '3d1fbdb3-a863-4dfc-a426-3c9953e1bbbf', '8322bc38-3b81-4355-b9af-60045932a041', 'ACTIVO', now(), now(), '3d5f0471-39fe-42b8-be26-bc6569492279'),
    ('620a447e-63e0-4b1f-aede-adeccb68efc9', 'Modulos',               '/app/modules',           'boxes',         3, '3d1fbdb3-a863-4dfc-a426-3c9953e1bbbf', '8322bc38-3b81-4355-b9af-60045932a041', 'ACTIVO', now(), now(), '3d5f0471-39fe-42b8-be26-bc6569492279'),
    ('b76a24c8-620f-44e3-af3f-5226e343a6c6', 'Menus',                 '/app/menus',             'menu',          4, '3d1fbdb3-a863-4dfc-a426-3c9953e1bbbf', '8322bc38-3b81-4355-b9af-60045932a041', 'ACTIVO', now(), now(), '3d5f0471-39fe-42b8-be26-bc6569492279'),
    ('ef6c1437-9347-4ba7-acdb-5b7911b3e446', 'Servicios externos',    '/app/external-services', 'plug',          5, '3d1fbdb3-a863-4dfc-a426-3c9953e1bbbf', '8322bc38-3b81-4355-b9af-60045932a041', 'ACTIVO', now(), now(), '3d5f0471-39fe-42b8-be26-bc6569492279'),
    -- Raiz del modulo de Ventas
    ('8936f02d-2418-4677-ab7e-9468c761282f', 'Ventas',                '/app/sales',             'shopping-cart', 1, 'c43cd32f-334d-4296-a72d-e3a08082f368', NULL,                                   'ACTIVO', now(), now(), '3d5f0471-39fe-42b8-be26-bc6569492279'),
    ('3c06bd5a-b838-4b39-9928-dc5f86a79806', 'Pedidos',               '/ventas/ordenes',        'receipt',       2, 'c43cd32f-334d-4296-a72d-e3a08082f368', '8936f02d-2418-4677-ab7e-9468c761282f', 'ACTIVO', now(), now(), '3d5f0471-39fe-42b8-be26-bc6569492279')
ON CONFLICT ("id") DO UPDATE SET
    "estado" = 'ACTIVO',
    "nombre" = EXCLUDED."nombre",
    "url" = EXCLUDED."url",
    "icono" = EXCLUDED."icono",
    "orden" = EXCLUDED."orden",
    "modulo_id" = EXCLUDED."modulo_id",
    "parent_id" = EXCLUDED."parent_id",
    "fecha_actualizacion" = now();

-- ---------------------------------------------------------------------
-- ROL_MENUS
-- ADMIN ve todo; VENTAS solo los menus del modulo de Ventas.
-- ---------------------------------------------------------------------
INSERT INTO "rol_menus" ("id", "rol_id", "menu_id", "estado", "fecha_creacion", "fecha_actualizacion", "creado_por")
SELECT gen_random_uuid(), 'bed7be1f-4d90-4847-bf54-92b65570870a', m."id", 'ACTIVO', now(), now(), '3d5f0471-39fe-42b8-be26-bc6569492279'
FROM "menus" m
WHERE m."modulo_id" IN ('3d1fbdb3-a863-4dfc-a426-3c9953e1bbbf', 'c43cd32f-334d-4296-a72d-e3a08082f368')
ON CONFLICT ("rol_id", "menu_id") DO UPDATE SET
    "estado" = 'ACTIVO',
    "fecha_actualizacion" = now();

INSERT INTO "rol_menus" ("id", "rol_id", "menu_id", "estado", "fecha_creacion", "fecha_actualizacion", "creado_por")
SELECT gen_random_uuid(), '85fcd9ad-c9f7-409e-85b8-57b7cc2ae5a6', m."id", 'ACTIVO', now(), now(), '3d5f0471-39fe-42b8-be26-bc6569492279'
FROM "menus" m
WHERE m."modulo_id" = 'c43cd32f-334d-4296-a72d-e3a08082f368'
ON CONFLICT ("rol_id", "menu_id") DO UPDATE SET
    "estado" = 'ACTIVO',
    "fecha_actualizacion" = now();

COMMIT;

-- ---------------------------------------------------------------------
-- Verificacion rapida
-- ---------------------------------------------------------------------
-- SELECT 'usuarios' t, count(*) FROM "usuarios"
-- UNION ALL SELECT 'roles',        count(*) FROM "roles"
-- UNION ALL SELECT 'modulos',      count(*) FROM "modulos"
-- UNION ALL SELECT 'menus',        count(*) FROM "menus"
-- UNION ALL SELECT 'rol_menus',    count(*) FROM "rol_menus";
