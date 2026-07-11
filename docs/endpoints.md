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

| Metodo | Ruta | Rol | Uso |
| --- | --- | --- | --- |
| `POST` | `/auth/logout` | Autenticado | Revoca refresh token |
| `GET` | `/menus/tree` | Autenticado | Devuelve menu dinamico del rol activo |
| `GET` | `/users` | `ADMIN` | Lista usuarios activos |
| `POST` | `/users` | `ADMIN` | Crea usuario |
| `PUT` | `/users/:id` | `ADMIN` | Actualiza usuario |
| `DELETE` | `/users/:id` | `ADMIN` | Inactiva usuario |
| `GET` | `/roles` | `ADMIN` | Lista roles activos |
| `POST` | `/roles` | `ADMIN` | Crea rol |
| `PUT` | `/roles/:id` | `ADMIN` | Actualiza rol |
| `DELETE` | `/roles/:id` | `ADMIN` | Inactiva rol |
| `POST` | `/roles/:id/users` | `ADMIN` | Asigna usuario a rol |
| `DELETE` | `/roles/:id/users/:userId` | `ADMIN` | Inactiva asignacion usuario-rol |
| `POST` | `/roles/:id/modules` | `ADMIN` | Asigna modulo a rol |
| `POST` | `/roles/:id/menus` | `ADMIN` | Asigna menu a rol |
| `GET` | `/modules` | `ADMIN` | Lista modulos activos |
| `GET` | `/modules/:id` | `ADMIN` | Obtiene modulo |
| `POST` | `/modules` | `ADMIN` | Crea modulo |
| `PUT` | `/modules/:id` | `ADMIN` | Actualiza modulo |
| `DELETE` | `/modules/:id` | `ADMIN` | Inactiva modulo |
| `GET` | `/menus` | `ADMIN` | Lista menus activos |
| `POST` | `/menus` | `ADMIN` | Crea menu |
| `PUT` | `/menus/:id` | `ADMIN` | Actualiza menu |
| `DELETE` | `/menus/:id` | `ADMIN` | Inactiva menu |

## Microservicio hijo `ventas`

Base local: `http://localhost:3006`

| Metodo | Ruta | Requisito | Uso |
| --- | --- | --- | --- |
| `GET` | `/health` | Publico | Estado del microservicio |
| `GET` | `/ventas/ordenes` | `Authorization: Bearer <accessToken>` | Devuelve ordenes demo despues de validar token contra el Master |
