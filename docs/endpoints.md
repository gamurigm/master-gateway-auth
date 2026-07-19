# Endpoints

Base local: `http://localhost:3000/api`

## Publicos

| Metodo | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/health` | Estado del servicio |
| `GET` | `/health/db` | Estado de conexion con PostgreSQL |
| `POST` | `/auth/login` | Valida credenciales y devuelve `tempToken` + roles |
| `POST` | `/auth/select-role` | Emite `accessToken` y `refreshToken` para un rol activo |
| `POST` | `/auth/refresh-token` | Rota el refresh token y emite una nueva sesion |
| `POST` | `/internals/validate-token` | Validacion Zero Trust para servicios hijos, protegida por `x-internal-api-key` y `x-internal-service` |

## Protegidos

Requieren `Authorization: Bearer <accessToken>`.

| Metodo | Ruta | Permiso/Politica | Uso |
| --- | --- | --- | --- |
| `POST` | `/auth/logout` | Autenticado | Revoca refresh token |
| `GET` | `/menus/tree` | Autenticado | Devuelve menu dinamico del rol activo |
| `GET` | `/permissions` | `permissions:read` | Lista catalogo de permisos |
| `GET` | `/users` | `users:read` | Lista usuarios activos |
| `POST` | `/users` | `users:create` | Crea usuario |
| `PUT` | `/users/:id` | `users:update` | Actualiza usuario |
| `DELETE` | `/users/:id` | `users:delete_soft` | Inactiva usuario |
| `GET` | `/roles` | `roles:read` | Lista roles activos con asignaciones |
| `GET` | `/roles/:id` | `roles:read` | Obtiene detalle de rol |
| `POST` | `/roles` | `roles:create` + politicas OPA dinamicas | Crea rol, opcionalmente con permisos iniciales |
| `PUT` | `/roles/:id` | `roles:update` + politica OPA dinamica | Actualiza rol |
| `DELETE` | `/roles/:id` | `roles:delete_soft` + politica OPA dinamica | Inactiva rol |
| `POST` | `/roles/:id/users` | `roles:assign_user` + politica OPA dinamica | Asigna usuario a rol |
| `DELETE` | `/roles/:id/users/:userId` | `roles:unassign_user` + politica OPA dinamica | Inactiva asignacion usuario-rol |
| `POST` | `/roles/:id/modules` | `roles:assign_module` + politica OPA dinamica | Asigna modulo a rol |
| `DELETE` | `/roles/:id/modules/:moduleId` | `roles:unassign_module` + politica OPA dinamica | Inactiva asignacion rol-modulo |
| `POST` | `/roles/:id/menus` | `roles:assign_menu` + politica OPA dinamica | Asigna menu a rol |
| `DELETE` | `/roles/:id/menus/:menuId` | `roles:unassign_menu` + politica OPA dinamica | Inactiva asignacion rol-menu |
| `POST` | `/roles/:id/permissions` | Politica OPA dinamica `roles:assign_permission` | Asigna permiso a rol |
| `DELETE` | `/roles/:id/permissions/:permissionId` | Politica OPA dinamica `roles:unassign_permission` | Inactiva asignacion rol-permiso |
| `GET` | `/modules` | `modules:read` | Lista modulos activos |
| `GET` | `/modules/:id` | `modules:read` | Obtiene modulo |
| `POST` | `/modules` | `modules:create` | Crea modulo |
| `PUT` | `/modules/:id` | `modules:update` | Actualiza modulo |
| `DELETE` | `/modules/:id` | `modules:delete_soft` | Inactiva modulo |
| `GET` | `/menus` | `menus:read` | Lista menus activos |
| `POST` | `/menus` | `menus:create` | Crea menu |
| `PUT` | `/menus/:id` | `menus:update` | Actualiza menu |
| `DELETE` | `/menus/:id` | `menus:delete_soft` | Inactiva menu |

## Microservicio hijo `ventas`

Base local: `http://localhost:3006`

| Metodo | Ruta | Requisito | Uso |
| --- | --- | --- | --- |
| `GET` | `/health` | Publico | Estado del microservicio |
| `GET` | `/ventas/ordenes` | `Authorization: Bearer <accessToken>` | Devuelve ordenes demo despues de validar token contra el Master |

## Microservicio hijo `inventario`

Base local: `http://localhost:3007`

| Metodo | Ruta | Auth | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/health` | No | Health del servicio |
| `GET` | `/inventario/productos` | `Authorization: Bearer <accessToken>` | Devuelve productos demo despues de validar token contra el Master |
