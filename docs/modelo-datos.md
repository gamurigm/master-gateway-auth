# Modelo de Datos

## Tecnología

- ORM: Prisma
- Base de datos: PostgreSQL 16
- Identificadores: UUID v4
- Estrategia de borrado: Soft delete mediante campo `estado` (`ACTIVO` / `INACTIVO`)

## Campos comunes en todas las tablas

Todas las entidades incluyen los siguientes campos de auditoría:

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `id` | UUID | Identificador único generado automáticamente |
| `estado` | Enum `Estado` | `ACTIVO` (por defecto) o `INACTIVO` |
| `fecha_creacion` | Timestamp | Asignado automáticamente al insertar |
| `fecha_actualizacion` | Timestamp | Actualizado automáticamente en cada `UPDATE` |
| `creado_por` | UUID nullable | ID del usuario que creó el registro |
| `actualizado_por` | UUID nullable | ID del usuario que actualizó el registro |

---

## Entidades

### `usuarios`

Almacena las credenciales y datos básicos de los usuarios del sistema.

| Campo | Tipo | Restricción |
| --- | --- | --- |
| `id` | UUID | PK, generado automáticamente |
| `email` | String | `UNIQUE`, requerido |
| `password_hash` | String | Argon2id, nunca se expone en respuestas |
| `nombres` | String | Requerido |
| `apellidos` | String | Nullable |
| + campos comunes | — | — |

**Relaciones:**
- 1:N con `usuario_roles`
- 1:N con `refresh_tokens`

---

### `roles`

Define los roles de trabajo disponibles en el sistema.

| Campo | Tipo | Restricción |
| --- | --- | --- |
| `id` | UUID | PK |
| `nombre` | String | `UNIQUE` |
| `descripcion` | String | Nullable |
| + campos comunes | — | — |

**Relaciones:**
- 1:N con `usuario_roles`
- 1:N con `rol_modulos`
- 1:N con `rol_menus`
- 1:N con `refresh_tokens`

---

### `usuario_roles` (Pivote M:N)

Relaciona usuarios con roles. Permite que un usuario tenga múltiples roles con auditoría de asignación.

| Campo | Tipo | Restricción |
| --- | --- | --- |
| `id` | UUID | PK |
| `usuario_id` | UUID | FK → `usuarios.id` |
| `rol_id` | UUID | FK → `roles.id` |
| + campos comunes | — | — |

**Índice único parcial:** `(usuario_id, rol_id)` — previene duplicados activos.

---

### `modulos`

Agrupa menús en módulos funcionales del sistema (ej. Administración, Ventas).

| Campo | Tipo | Restricción |
| --- | --- | --- |
| `id` | UUID | PK |
| `codigo` | String | `UNIQUE` |
| `nombre` | String | Requerido |
| `descripcion` | String | Nullable |
| + campos comunes | — | — |

**Relaciones:**
- 1:N con `menus`
- 1:N con `rol_modulos`

---

### `rol_modulos` (Pivote M:N)

Relaciona roles con módulos. Define qué módulos puede ver cada rol.

| Campo | Tipo | Restricción |
| --- | --- | --- |
| `id` | UUID | PK |
| `rol_id` | UUID | FK → `roles.id` |
| `modulo_id` | UUID | FK → `modulos.id` |
| + campos comunes | — | — |

**Índice único:** `(rol_id, modulo_id)`

---

### `menus`

Estructura de navegación jerárquica. Soporta árbol recursivo mediante `parent_id` (adjacency list).

| Campo | Tipo | Restricción |
| --- | --- | --- |
| `id` | UUID | PK |
| `nombre` | String | Requerido |
| `url` | String | Nullable — `null` en nodos agrupadores |
| `icono` | String | Nullable |
| `orden` | Int | Default `0` |
| `modulo_id` | UUID | FK → `modulos.id` |
| `parent_id` | UUID | FK self-referencial → `menus.id`, nullable para raíz |
| + campos comunes | — | — |

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

| Campo | Tipo | Restricción |
| --- | --- | --- |
| `id` | UUID | PK |
| `rol_id` | UUID | FK → `roles.id` |
| `menu_id` | UUID | FK → `menus.id` |
| + campos comunes | — | — |

**Índice único:** `(rol_id, menu_id)`

---

### `refresh_tokens`

Almacena el hash de los refresh tokens para implementar rotación y detección de reutilización.

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `id` | UUID | PK |
| `usuario_id` | UUID | FK → `usuarios.id` |
| `rol_id` | UUID | FK → `roles.id` (rol que autorizó la sesión) |
| `jti` | String | JWT ID, `UNIQUE`, permite revocación por familia |
| `token_hash` | String | Hash del refresh token (Argon2id / SHA-256) |
| `expira_en` | Timestamp | Fecha de expiración |
| `revocado_en` | Timestamp | Nullable, fecha de revocación explícita |
| `reemplazado_por_jti` | String | Nullable, JTI del token sucesor (rotación) |
| `reutilizacion_detectada` | Boolean | `true` si se detectó re-uso del token |
| + campos comunes | — | — |

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

Ninguna entidad usa `DELETE` físico. El borrado se realiza cambiando `estado = INACTIVO`. Esto garantiza:

1. **Trazabilidad**: Los registros históricos se preservan.
2. **Integridad referencial**: Las claves foráneas permanecen válidas.
3. **Auditoría**: Se registra quién y cuándo inactivó el registro.

Los endpoints de listado (`GET /api/users`, `GET /api/roles`, etc.) filtran automáticamente por `estado = ACTIVO`.

---

## Seed inicial

Ejecutar `npm run prisma:seed` crea:

| Entidad | Valor |
| --- | --- |
| Usuario | `admin@example.com` / `Admin12345!` |
| Rol | `ADMIN` |
| Módulo | `Administración` (código: `ADMIN`) |
| Menús raíz | Usuarios, Roles, Módulos, Menús |

El password del seed se hashea con Argon2id en tiempo de ejecución; nunca se almacena en texto plano.
