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
| `GET` | `/menus/tree` | Autenticado | Arbol de menus del rol activo |
| `POST` | `/menus` | `ADMIN` | Crea menu |
| `PUT` | `/menus/:id` | `ADMIN` | Actualiza menu |
| `DELETE` | `/menus/:id` | `ADMIN` | Inactiva menu |
| `GET` | `/external-services` | `ADMIN` | Lista servicios externos registrados |
| `POST` | `/external-services/probe` | `ADMIN` | Verifica un servicio SIN registrarlo (probe anti-SSRF) |
| `GET` | `/external-services/:id` | `ADMIN` | Obtiene un servicio |
| `POST` | `/external-services` | `ADMIN` | Registra un servicio (exige probe exitoso) |
| `POST` | `/external-services/:id/probe` | `ADMIN` | Re-verifica y persiste el estado |
| `POST` | `/external-services/:id/provision` | `ADMIN` | Genera modulo, menus y asignaciones de rol |
| `PUT` | `/external-services/:id` | `ADMIN` | Actualiza un servicio |
| `DELETE` | `/external-services/:id` | `ADMIN` | Inactiva un servicio |

### Flujo de registro de un microservicio externo

1. `POST /external-services/probe` con `{ baseUrl, healthPath }` — comprueba que el servicio
   responde y descubre endpoints por OpenAPI si expone `openApiPath`. **No persiste nada.**
2. `POST /external-services` — registra el servicio. El backend **vuelve a verificar** el probe;
   un servicio caido no se registra (generaria menus rotos).
3. `POST /external-services/:id/provision` con `{ roleIds, items }` — en una transaccion crea el
   modulo, un menu raiz agrupador (sin `url`) y un menu hoja por endpoint (con `url`), mas las
   asignaciones rol-modulo y rol-menu. El frontend recarga el arbol e inyecta las rutas con
   `router.addRoute()` sin recargar la pagina.

## Microservicio hijo `ventas`

Base local: `http://localhost:3006`

| Metodo | Ruta | Requisito | Uso |
| --- | --- | --- | --- |
| `GET` | `/health` | Publico | Estado del microservicio |
| `GET` | `/ventas/ordenes` | `Authorization: Bearer <accessToken>` | Devuelve ordenes demo despues de validar token contra el Master |
