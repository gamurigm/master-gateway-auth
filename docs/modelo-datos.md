# Modelo de Datos

## Tecnología

- ORM: Prisma
- Base de datos: PostgreSQL 16
- Identificadores: UUID v4
- Estrategia de borrado: Soft delete mediante campo `estado` (`ACTIVO` / `INACTIVO`)

## Campos comunes en todas las tablas

Todas las entidades incluyen los siguientes campos de auditoría:

| Campo                 | Tipo          | Descripción                                  |
| --------------------- | ------------- | -------------------------------------------- |
| `id`                  | UUID          | Identificador único generado automáticamente |
| `estado`              | Enum `Estado` | `ACTIVO` (por defecto) o `INACTIVO`          |
| `fecha_creacion`      | Timestamp     | Asignado automáticamente al insertar         |
| `fecha_actualizacion` | Timestamp     | Actualizado automáticamente en cada `UPDATE` |
| `creado_por`          | UUID nullable | ID del usuario que creó el registro          |
| `actualizado_por`     | UUID nullable | ID del usuario que actualizó el registro     |

---

## Entidades

### `usuarios`

Almacena las credenciales y datos básicos de los usuarios del sistema.

| Campo            | Tipo   | Restricción                             |
| ---------------- | ------ | --------------------------------------- |
| `id`             | UUID   | PK, generado automáticamente            |
| `email`          | String | `UNIQUE`, requerido                     |
| `password_hash`  | String | Argon2id, nunca se expone en respuestas |
| `nombres`        | String | Requerido                               |
| `apellidos`      | String | Nullable                                |
| + campos comunes | —      | —                                       |

**Relaciones:**

- 1:N con `usuario_roles`
- 1:N con `refresh_tokens`

---

### `roles`

Define los roles de trabajo disponibles en el sistema.

| Campo            | Tipo   | Restricción |
| ---------------- | ------ | ----------- |
| `id`             | UUID   | PK          |
| `nombre`         | String | `UNIQUE`    |
| `descripcion`    | String | Nullable    |
| + campos comunes | —      | —           |

**Relaciones:**

- 1:N con `usuario_roles`
- 1:N con `rol_modulos`
- 1:N con `rol_menus`
- 1:N con `refresh_tokens`

---

### `usuario_roles` (Pivote M:N)

Relaciona usuarios con roles. Permite que un usuario tenga múltiples roles con auditoría de asignación.

| Campo            | Tipo | Restricción        |
| ---------------- | ---- | ------------------ |
| `id`             | UUID | PK                 |
| `usuario_id`     | UUID | FK → `usuarios.id` |
| `rol_id`         | UUID | FK → `roles.id`    |
| + campos comunes | —    | —                  |

**Índice único parcial:** `(usuario_id, rol_id)` — previene duplicados activos.

---

### `modulos`

Agrupa menús en módulos funcionales del sistema (ej. Administración, Ventas).

| Campo            | Tipo   | Restricción |
| ---------------- | ------ | ----------- |
| `id`             | UUID   | PK          |
| `codigo`         | String | `UNIQUE`    |
| `nombre`         | String | Requerido   |
| `descripcion`    | String | Nullable    |
| + campos comunes | —      | —           |

**Relaciones:**

- 1:N con `menus`
- 1:N con `rol_modulos`

---

### `rol_modulos` (Pivote M:N)

Relaciona roles con módulos. Define qué módulos puede ver cada rol.

| Campo            | Tipo | Restricción       |
| ---------------- | ---- | ----------------- |
| `id`             | UUID | PK                |
| `rol_id`         | UUID | FK → `roles.id`   |
| `modulo_id`      | UUID | FK → `modulos.id` |
| + campos comunes | —    | —                 |

**Índice único:** `(rol_id, modulo_id)`

---

### `menus`

Estructura de navegación jerárquica. Soporta árbol recursivo mediante `parent_id` (adjacency list).

| Campo            | Tipo   | Restricción                                          |
| ---------------- | ------ | ---------------------------------------------------- |
| `id`             | UUID   | PK                                                   |
| `nombre`         | String | Requerido                                            |
| `url`            | String | Nullable — `null` en nodos agrupadores               |
| `icono`          | String | Nullable                                             |
| `orden`          | Int    | Default `0`                                          |
| `modulo_id`      | UUID   | FK → `modulos.id`                                    |
| `parent_id`      | UUID   | FK self-referencial → `menus.id`, nullable para raíz |
| + campos comunes | —      | —                                                    |

**Índices:** `(parent_id)`, `(modulo_id)`

**Reglas de integridad:**

- `parent_id = null` indica menú raíz.
- `url = null` se permite para nodos agrupadores (carpetas de menú).
- Mover un nodo no debe crear ciclos (validado en servicio).
- Inactivar un nodo padre excluye a todos sus hijos en el árbol devuelto.

**Relaciones:**

- Auto-referencial: `parent → children` (relación `MenuTree`)
- 1:N con `rol_menus`

---

### `rol_menus` (Pivote M:N)

Define qué ítems de menú puede acceder cada rol.

| Campo            | Tipo | Restricción     |
| ---------------- | ---- | --------------- |
| `id`             | UUID | PK              |
| `rol_id`         | UUID | FK → `roles.id` |
| `menu_id`        | UUID | FK → `menus.id` |
| + campos comunes | —    | —               |

**Índice único:** `(rol_id, menu_id)`

---

### `refresh_tokens`

Almacena el hash de los refresh tokens para implementar rotación y detección de reutilización.

| Campo                     | Tipo      | Descripción                                      |
| ------------------------- | --------- | ------------------------------------------------ |
| `id`                      | UUID      | PK                                               |
| `usuario_id`              | UUID      | FK → `usuarios.id`                               |
| `rol_id`                  | UUID      | FK → `roles.id` (rol que autorizó la sesión)     |
| `jti`                     | String    | JWT ID, `UNIQUE`, permite revocación por familia |
| `token_hash`              | String    | Hash del refresh token (Argon2id / SHA-256)      |
| `expira_en`               | Timestamp | Fecha de expiración                              |
| `revocado_en`             | Timestamp | Nullable, fecha de revocación explícita          |
| `reemplazado_por_jti`     | String    | Nullable, JTI del token sucesor (rotación)       |
| `reutilizacion_detectada` | Boolean   | `true` si se detectó re-uso del token            |
| + campos comunes          | —         | —                                                |

**Índices:** `(usuario_id)`, `(rol_id)`, `UNIQUE(jti)`

---

## Diagrama de relaciones (ERD simplificado)

```
usuarios ──< usuario_roles >── roles
                                  │
                         ┌────────┤
                         │        │
                      rol_modulos rol_menus
                         │        │
                      modulos    menus (auto-join: parent_id)
                         │        │
                         └────────┘
                              │
                       (menus pertenecen a un módulo)

usuarios ──< refresh_tokens >── roles
```

---

## Estrategia de Soft Delete

Por defecto, las entidades administrativas usan borrado logico cambiando `estado = INACTIVO`. La unica excepcion operativa es usuarios: `SUPER_ADMIN` puede borrar fisicamente un usuario, mientras que `ADMIN` solo lo inactiva y bloquea sus sesiones. Esto garantiza:

1. **Trazabilidad**: Los registros históricos se preservan.
2. **Integridad referencial**: Las claves foráneas permanecen válidas.
3. **Auditoría**: Se registra quién y cuándo inactivó el registro.

Los endpoints de listado (`GET /api/users`, `GET /api/roles`, etc.) filtran automaticamente por `estado = ACTIVO`. El seed de arranque registra `_seed_runs/core-security-v2` y, despues del bootstrap inicial, ya no vuelve a recrear ni sobrescribir usuarios, roles, modulos, menus o asignaciones borradas/modificadas desde la UI.

---

## Seed inicial

Hay **dos caminos equivalentes**, que usan exactamente los mismos identificadores
y convergen al mismo estado de bootstrap. Ambos son seguros para arranques repetidos:
si ya existe `_seed_runs/core-security-v2`, el seed se omite.

| Camino     | Comando                   | Cuándo                                                                          |
| ---------- | ------------------------- | ------------------------------------------------------------------------------- |
| TypeScript | `npm run prisma:seed`     | Desarrollo y arranque en Render. Hashea con Argon2id en tiempo de ejecución     |
| SQL puro   | `npm run prisma:seed:sql` | Restauración directa sobre la base, contenedores, `initContainer` de Kubernetes |

El archivo SQL vive en `backend/prisma/seeds/seed.sql`. Usa inserciones no destructivas y una marca en `_seed_runs` para no resembrar datos base despues del primer bootstrap.

Datos creados:

| Entidad  | Valor                                                                                                                                                                               |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Usuarios | `superadmin@example.com` / `SuperAdmin12345!` con `SUPER_ADMIN`, `admin@example.com` / `Admin12345!` con `ADMIN`, `demo@example.com` con `USER` y `ventas@example.com` con `VENTAS` |
| Roles    | `SUPER_ADMIN`, `ADMIN`, `USER`, `VENTAS`                                                                                                                                            |
| Módulos  | `Administración` (`ADMIN`), `Ventas` (`VENTAS`)                                                                                                                                     |
| Menús    | 8 nodos: 2 raices agrupadoras y 6 hojas con `url`; `SUPER_ADMIN` y `ADMIN` ven todos                                                                                                |

El password del seed en TypeScript se hashea con Argon2id en tiempo de ejecución.
El archivo SQL lleva los hashes Argon2id ya precomputados de esas credenciales de
demo; nunca contiene contraseñas en texto plano. En un despliegue real el
superadministrador y administrador se crean con `SEED_SUPER_ADMIN_PASSWORD` y `SEED_ADMIN_PASSWORD` desde el entorno.

### Sobre los identificadores

Todos los IDs de demo son **UUID v4 generados aleatoriamente** con
`crypto.randomUUID()`.

Las generaciones anteriores usaban valores con patrón
(`11111111-1111-4111-8111-111111111111`, `aaaaaaa1-aaaa-4aaa-8aaa-...`). Eran
sintácticamente válidos como v4 — se cuidó el nibble de versión `4` y el de
variante `8` para que `ParseUUIDPipe({ version: '4' })` los aceptara — pero no
eran aleatorios. Durante el bootstrap inicial, ambos seeds limpian esos IDs antiguos para que
una base ya sembrada no conserve menús huérfanos.
