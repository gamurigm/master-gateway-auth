# Revisión de cumplimiento — Proyecto Integrador Parcial III (Master Gateway)

**Enunciado:** `PROY_PARCIAL_III_DesSeguro_202650 (3).pdf` (20 pág.)
**Código revisado:** `D:\master-gateway-auth` (solo lectura)
**Fecha:** 2026-07-24
**Stack detectado:** NestJS + Prisma (ORM) + PostgreSQL (backend), Vue 3 + Pinia + Vue Router (frontend-vue), microservicio hijo Node HTTP (services/ventas), CI/CD GitHub Actions + SonarQube + CodeBERT SAST + Render + Telegram.

Nota de rutas: el backend aplica `setGlobalPrefix('api')` (`backend/src/main.ts:12`), por lo que un controlador `@Post('auth/login')` expone `/api/auth/login`. Las rutas de la tabla se comparan ya con ese prefijo.

---

## 1. Objetivos Específicos (PDF §3.1)

| Requisito (PDF) | Estado | Evidencia (archivo:línea) | Notas |
|---|---|---|---|
| **OE1** Modelo relacional M:N Usuarios–Roles con tabla pivote intermedia | Cumple | `backend/prisma/schema.prisma:49-63` (`UserRole` / `usuario_roles`, `@@unique([userId, roleId])`) | Pivote con auditoría completa (ver §5). Relaciones a `User` y `Role`. |
| **OE2** Menús dinámicos y recursivos en UNA sola tabla (Módulos/Submenús/Items) asociados a roles | Cumple (con desvío técnico en la recursividad) | `schema.prisma:129-150` (tabla única `menus`, `parentId` self-relation "MenuTree", `moduleId`); asociación a rol vía `RoleMenu` `schema.prisma:152-166` | Adjacency List correcto. La recursividad se resuelve en memoria, no con CTE (ver §6 y Gaps). |
| **OE3** Login con selección activa de rol, cargando solo módulo/menú de ese rol (Workspace Selector) | Cumple | `auth.controller.ts:37-46` (login → select-role); frontend `LoginView.vue:51` (`router.push('/select-role')`); `menus.service.ts:32-95` (`treeForRole`) | El árbol se filtra por `roleId` del token; el token lleva solo el rol elegido. |
| **OE4** Arquitectura para microservicios hijos; el Master emite y valida tokens (JWT/OAuth2) bajo Zero Trust | Cumple | Emisión: `auth.service.ts:347-417`; validación interna: `auth.service.ts:268-321`; hijo real: `services/ventas/src/server.ts:67-131` | Tokens JWE (RSA-OAEP-256/A256GCM). El hijo Ventas NO tiene BD de usuarios y valida vía `POST /api/internals/validate-token` (estrategia a). Ver matiz en Gaps sobre validación asimétrica offline. |
| **OE5** Shift-Left: pruebas unitarias, sanitización, anti-inyección SQL vía ORM, cifrado de contraseñas | Cumple | 13 specs unitarios + 1 e2e (`backend/test/app.e2e-spec.ts`); sanitización `common/decorators/sanitize.decorator.ts`; Prisma parametrizado (sin `queryRawUnsafe`); Argon2 `users.service.ts:66`,`auth.service.ts:403` | SAST (SonarQube + CodeBERT) en CI. Detalle en §4. |

---

## 2. Requisitos Funcionales (PDF §4–§5, §7.3)

| Requisito (PDF) | Estado | Evidencia | Notas |
|---|---|---|---|
| §4 Usuarios↔Roles M:N con join `usuario_id`–`rol_id` | Cumple | `schema.prisma:49-63` | — |
| §4 Roles↔Módulos (1:N o M:N) | Cumple | `RoleModule`/`rol_modulos` `schema.prisma:113-127` | Adoptan M:N con pivote auditado (más granular que la opción mínima FK). |
| §4 Menú: campos `id, nombre, url` (solo hoja), `modulo_id`, `parent_id` (NULL=principal) | Cumple | `schema.prisma:129-150` | `url` es nullable; el código NO fuerza que sólo las hojas tengan url (el frontend permite padre "clicable"), matiz descriptivo, no bloqueante. |
| §5.1 CRUD completo Usuarios y Roles + integridad/consistencia transaccional | Cumple | `users.controller.ts`, `roles.controller.ts`; `$transaction` en listados `users.service.ts:20-28` | — |
| §5.2 Creación de Módulos | Cumple | `modules.controller.ts:39-42` | — |
| §5.2 Asignación de Módulos a Roles | Cumple | `roles.controller.ts:82-89` → `roles.service.ts:173-182` | — |
| §5.2 CRUD Menús con Adjacency List (`parent_id`) | Cumple | `menus.controller.ts`, `menus.service.ts:97-148` | Valida ciclos (`assertNoCycle` `menus.service.ts:178-196`) y que el padre sea del mismo módulo. |
| §5.3 Workspace Selector: impedir carga directa del dashboard, forzar selección de rol | Cumple | `LoginView.vue:51` va a `/select-role`; `SelectRoleView.vue`; token definitivo sólo tras `select-role` (`auth.service.ts:104-143`) | Login devuelve `tempToken` (5 min) + lista de roles; el dashboard exige AccessToken emitido en select-role. |
| §5.3 Tenant/Rol Isolation a nivel de sesión | Cumple | Token lleva solo `roleId`/`roleName` (`auth.service.ts:360-376`); `stores/auth.ts:10-13` guarda un único rol activo | — |
| §5.4 / §7.3 Frontend SPA sin rutas hardcodeadas; inyección dinámica desde JSON del menú | Cumple (parcial) | `router/dynamic-routes.ts:41-77` (`registerMenuRoutes` con `router.addRoute`); `stores/menu.ts:23-37`; `router/index.ts:60-71` (recarga tras F5) | El mecanismo de inyección dinámica existe y funciona para módulos/servicios provisionados. Las vistas admin base (users/roles/modules/menus/external-services) SÍ están declaradas estáticas en `router/index.ts:24-42`. La navegación visible (Sidebar) se construye 100% desde el árbol del rol. Ver Gaps. |
| §7.2 Stateless con JWT | Cumple | Tokens autocontenidos JWE; sin sesión en memoria de servidor | Se persisten refresh tokens en BD para rotación/revocación (necesario para logout/reuse). |

---

## 3. Endpoints Mínimos (PDF §9, tabla) vs. implementación

| Endpoint requerido (PDF §9) | Estado | Implementado en | Notas |
|---|---|---|---|
| `POST /api/auth/login` | Cumple | `auth.controller.ts:37-40` | `@Throttle 5/60s` (rate limiting estricto); mensaje genérico `'Credenciales invalidas'` `auth.service.ts:71`. Devuelve `tempToken`+roles. |
| `POST /api/auth/select-role` | Cumple | `auth.controller.ts:43-46` | Access token corto **15m** `auth.service.ts:368`. Valida que el rol pertenezca al usuario `auth.service.ts:106-126`. |
| `POST /api/auth/refresh-token` | Cumple | `auth.controller.ts:49-52` | Rotación + **detección de reutilización** con revocación en cascada `auth.service.ts:164-185`. |
| `POST /api/auth/logout` | Cumple | `auth.controller.ts:55-65` | Invalida refresh token en BD (`estado=INACTIVO`) `auth.service.ts:241-266`. |
| `POST /api/internals/validate-token` | Cumple | `auth.controller.ts:67-74` | Protegido por `x-internal-api-key` + lista blanca de servicios `auth.service.ts:268-297`. Devuelve `valid,userId,roleId,roleName`. |
| `GET /api/users` (paginado, filtro estado=ACTIVO) | Cumple | `users.controller.ts:31-34` → `users.service.ts:18-36` | Paginación + `where estado:ACTIVO` + `omitPassword`. |
| `GET /api/users/{id}` (oculta password) | Cumple | `users.controller.ts:36-39`; `omitPassword` `users.service.ts:50` | — |
| `POST /api/users` (hash + validación fuerte) | Cumple | `users.controller.ts:41-44`; regex fuerte `dto/create-user.dto.ts:16-19`; Argon2 `users.service.ts:66` | `createdBy` seteado; `fecha_creacion` por ORM. |
| `PUT /api/users/{id}` | Cumple | `users.controller.ts:46-53` | `updatedBy`+`updatedAt` por ORM `users.service.ts:76-93`. |
| `DELETE /api/users/{id}` (soft delete) | Cumple | `users.service.ts:95-103` (`estado=INACTIVO`) | Nunca borra físico. |
| `GET /api/roles` (activos) | Cumple | `roles.controller.ts:32-35` → `roles.service.ts:16-54` | — |
| `POST /api/roles` | Cumple | `roles.controller.ts:42-45` | Conflicto si nombre duplicado. |
| `PUT /api/roles/{id}` | Cumple | `roles.controller.ts:47-54` | — |
| `DELETE /api/roles/{id}` (soft delete; prevenir si tiene usuarios activos) | Cumple | `roles.service.ts:126-148` | Rechaza inactivar si hay asignaciones activas `roles.service.ts:136-140`. |
| `POST /api/roles/{id}/users` (M:N, auditoría en pivote) | Cumple | `roles.service.ts:150-159` (`upsert` con `createdBy`/`updatedBy`) | — |
| `DELETE /api/roles/{id}/users/{userId}` (PDF dice "eliminación FÍSICA en pivote") | **Se desvía justificadamente** | `roles.service.ts:161-171` hace **soft delete** (`estado=INACTIVO`), NO físico | **Contradicción del propio PDF**: la tabla §9 pide borrado físico, pero la Nota de Implementación #3 (§16) exige que el pivote conserve auditoría "para saber cuándo se revocó un permiso". El código resuelve a favor de la auditoría/soft-delete. Ver §6. |
| `GET/POST/PUT/DELETE /api/modules(/{id})` | Cumple | `modules.controller.ts` (CRUD completo) | Al inactivar módulo, `treeForRole` lo excluye (`module:{estado:ACTIVO}`) `menus.service.ts:40`. |
| `POST /api/roles/{id}/modules` | Cumple | `roles.controller.ts:82-89` | — |
| `GET /api/menus/tree` (CRÍTICO: CTE vía ORM) | **Se desvía justificadamente** | `menus.controller.ts:28-31` → `menus.service.ts:32-95` | Endpoint existe y filtra por rol del JWT, pero arma el árbol **en memoria** (1 query plana + ensamblado en JS), NO con `WITH RECURSIVE`. Cumple el objetivo de rendimiento/anti-N+1; se aparta de la técnica CTE. Ver §6. |
| `POST /api/menus` (requiere parentId null=raíz, url) | Cumple | `menus.controller.ts:40-45` → `menus.service.ts:97-114` | — |
| `PUT /api/menus/{id}` (validar parent_id sin bucle) | Cumple | `menus.service.ts:116-138` + `assertNoCycle:178-196` | — |
| `DELETE /api/menus/{id}` (soft delete) | Cumple | `menus.service.ts:140-148` | — |
| `POST /api/roles/{id}/menus` | Cumple | `roles.controller.ts:91-98` → `roles.service.ts:184-193` | — |

**Nota de nomenclatura:** los diagramas de secuencia (§8.2) mencionan `/api/menu/structure`, pero la tabla de endpoints mínimos (§9, autoritativa) pide `/api/menus/tree`. El código implementa `/api/menus/tree`, alineado con §9.

---

## 4. Requisitos No Funcionales / Seguridad (PDF §6, Anexo)

| Requisito (PDF) | Estado | Evidencia | Notas |
|---|---|---|---|
| §6.1 ZTA: validación obligatoria de token en cada endpoint | Cumple | `JwtAuthGuard` en users/roles/modules/menus/external-services; e2e `app.e2e-spec.ts:123-134` (401 sin token, 403 no-admin) | Auth endpoints públicos por diseño; validate-token protegido por API key interna. |
| §6.1 Hijos sin BD propia de usuarios; validación directa o asimétrica | Cumple (estrategia a) | `services/ventas/src/server.ts:67-100` (llama al Master con reintentos) | JWE cifrado con clave pública del Master → solo el Master descifra (`jwe-token.ts:10-17`). Fuerza la estrategia (a) "validación directa". Ver Gaps sobre `GET /api/auth/public-key`. |
| §6.2 Menor privilegio: token solo con el rol elegido | Cumple | `auth.service.ts:360-376` (payload = `sub,jti,roleId,roleName` únicamente) | No incluye otros roles ni permisos globales del usuario. |
| §6.3 SAST en CI/CD desde el día 1 | Cumple | `.github/workflows/ci-cd.yml` — SonarQube (Quality Gate obligatorio, líneas 291-304) + CodeBERT SAST ML (CWE/OWASP) con self-test (55-92) | Cubre "SAST tradicional" y "SAST avanzado (minería de datos/ML)" del Anexo. |
| §6.3 Consultas parametrizadas exclusivas; prohibida interpolación de strings | Cumple | Sin `$queryRawUnsafe`/`$executeRawUnsafe` en `backend/src`; único raw es `$queryRaw`SELECT 1`` (health, parametrizado) `app.service.ts:14` | Todo el acceso a datos pasa por el query builder de Prisma. |
| §6.3 Hash robusto (Argon2/Bcrypt) | Cumple | Argon2id en create/update/login `users.service.ts:66,86`, `auth.service.ts:64,403` | — |
| §6.4 Gestión segura de secrets (env, prohibido hardcodeo) | Cumple | `config/env.validation.ts` rechaza defaults `change-me*` en producción (líneas 41-43); secrets vía GitHub Secrets en deploy `ci-cd.yml:684-691` | KeysService genera/lee claves RSA de disco, no hardcodeadas `common/keys/keys.service.ts`. |
| §6.4 Performance: menú optimizado anti-N+1 | Cumple | `menus.service.ts:33-48` = 1 sola query `roleMenu.findMany`; árbol en memoria | Sin N+1 (no consulta por nivel). Cumple el objetivo de rendimiento aunque no use CTE. |
| Anexo: Git branching (main/test/dev) | Cumple (parcial) | `ci-cd.yml:4-14` dispara en dev/test/main (+`dev-cesar`) | Rama de trabajo extra `dev-cesar` incluida temporalmente (comentado que debe quitarse al integrar). |
| Anexo: Pipeline (build+test, SonarCloud, SAST ML, deploy auto) | Cumple | `ci-cd.yml` jobs build-test / sonarqube / codebert-sast / deploy | Usa SonarQube Community self-hosted en CI en vez de SonarCloud SaaS (equivalente funcional). |
| Anexo: Deploy PaaS disparado por CLI (no webhook) | Cumple | `ci-cd.yml:693-702` (`render deploys create ... --confirm --wait`) | Render vía CLI tras gates. |
| Anexo: Notificaciones Telegram | Cumple | Inicio, Quality Gate, alerta SAST, deploy, merges dev/test/main/PR (`ci-cd.yml` múltiples jobs) | — |
| Anexo: hijos con Retry ante "sleep" del PaaS | Cumple (valor agregado) | `services/ventas/src/server.ts:70-100` (reintentos configurables) | Cumple la recomendación del §20. |

---

## 5. Auditoría y Soft-Delete (PDF §9 "Estándar de Campos" + Notas §16)

| Requisito (PDF) | Estado | Evidencia | Notas |
|---|---|---|---|
| Campos obligatorios por entidad: `id, estado, fecha_creacion, fecha_actualizacion, creado_por, actualizado_por` | Cumple | `schema.prisma`: `User`(15-30), `Role`(32-47), `SystemModule`(65-80), `Menu`(129-150), `RefreshToken`(168-189) | Todas las entidades los incluyen. `estado` es enum `Estado{ACTIVO,INACTIVO}`. Timestamps por ORM (`@default(now())`, `@updatedAt`). |
| **Pivote NO "tonta": auditoría en tablas M:N** (Nota #3) | Cumple | `UserRole:49-63`, `RoleModule:113-127`, `RoleMenu:152-166` — las 3 con `id,estado,createdAt,updatedAt,createdBy,updatedBy` | Punto explícitamente exigido; cumplido en las tres pivotes. |
| Soft delete: nunca borrado físico, `estado→INACTIVO` | Cumple | users `95-103`, roles `142-146`, modules, menus `140-148`, y **desasignaciones** `roles.service.ts:161-217` | Ninguna operación usa `prisma.*.delete()` físico; todo es `update estado:INACTIVO`. |
| `fecha_creacion`/`fecha_actualizacion` gestionadas por ORM (no manipulables desde el controlador) | Cumple | `@default(now())` + `@updatedAt` en schema; DTOs con `whitelist:true, forbidNonWhitelisted:true` `main.ts:21-27` | Los timestamps los maneja Prisma. `creado_por`/`actualizado_por` se pasan desde el `actorId` del token, no desde el body. |
| Nota #1: Hooks de ciclo de vida (`@BeforeUpdate/@BeforeInsert`) | Parcial | — | Prisma no usa hooks de entidad al estilo TypeORM; se apoya en atributos de schema + validación de DTO. Efecto equivalente (cliente no puede setear estado/timestamps), pero no por hooks. Menor. |
| Nota #2: Global Scope / filtro automático `estado:ACTIVO` a nivel ORM | Parcial (se desvía) | `prisma.service.ts` NO define middleware/extension global; cada consulta filtra `estado:ACTIVO` manualmente | Aplicado de forma consistente en todos los services, pero manual. Ver Gaps. |

---

## 6. Contradicciones del enunciado resueltas por el código (análisis)

1. **Desasignar rol — físico vs. auditado.** La tabla §9 dice *"Rompe la relación M:N (Eliminación física en la tabla pivote)"* para `DELETE /api/roles/{id}/users/{userId}`. Pero la Nota de Implementación #3 (§16) dice que la pivote *"no es una tabla tonta; debe heredar campos de auditoría para saber cuándo se le otorgó o revocó un permiso"*, y el Estándar Global (§9-10) dice *"Nunca se debe eliminar físicamente un registro"*. **Son mutuamente excluyentes.** El código (`roles.service.ts:161-171`) hace **soft delete** (`estado=INACTIVO`), coherente con la política global y con la auditoría de la pivote. Es la resolución correcta de la contradicción, aunque literalmente se aparta de la celda "eliminación física" de la tabla. **Recomendación:** documentar esta decisión para el evaluador.

2. **Menú recursivo — CTE vs. en memoria.** §4.2, §6.4 y la celda "CRÍTICO" de §9 piden que *"el ORM use CTE (WITH RECURSIVE)"*. El código no emite CTE: hace `roleMenu.findMany` (una query plana con todos los menús del rol) y ensambla el árbol con `Map` en JS (`menus.service.ts:59-94`). Justificación técnica: **Prisma no soporta CTE recursivas nativas** por el query builder; hacerlo exigiría `$queryRawUnsafe`/SQL crudo, lo que chocaría con §6.3 ("consultas parametrizadas exclusivas"). El enfoque en memoria **cumple el objetivo real** (una sola consulta, sin N+1, tiempos predecibles). Es un desvío de la *técnica* sugerida, no del *objetivo*. Test que lo respalda: `menus.service.spec.ts:35-88`.

---

## 7. Valor agregado (más allá del enunciado)

- **Tokens JWE (cifrados), no solo firmados.** `EncryptJWT` RSA-OAEP-256 + A256GCM (`auth.service.ts:360-394`): los claims viajan cifrados (confidencialidad), superior al JWT firmado que pide el PDF.
- **Rotación de refresh tokens con detección de reutilización** y revocación en cascada de toda la familia del token (`auth.service.ts:164-185`) — patrón OWASP de refresh-token rotation.
- **Microservicio hijo real y funcional** (`services/ventas`) que demuestra el flujo Zero Trust del §8.3 completo, con **reintentos** ante el "sleep" del PaaS (recomendación del §20) y su propio test (`server.spec.ts`).
- **Módulo `external-services`**: alta, *probe* de salud, y **`provision`** que autogenera módulo+menús+asignaciones para un servicio hijo, haciendo el ecosistema extensible sin tocar código (incluye guard anti-SSRF con `ssrf-guard.spec.ts`).
- **Rate limiting** granular por endpoint (`@Throttle` en login/select-role/refresh/probe) + `ThrottlerGuard` global (`app.module.ts:22-27,47-50`).
- **CodeBERT SAST (modelo ML) con self-test** que verifica que el agente sigue detectando fixtures vulnerables antes de confiar en su veredicto (`ci-cd.yml:56-92`) — implementación seria del "SAST avanzado por minería de datos".
- **Hardening extra**: `helmet`, CORS restringido por origen, `etag` deshabilitado, logging estructurado con request-id, `omitPassword` en toda serialización, `env.validation` que aborta el arranque en producción con secretos por defecto.
- **13 specs unitarios + 1 e2e** (guards, sanitización, keys, env, todos los services). El enunciado sólo pedía "pruebas unitarias".

---

## 8. Gaps de cumplimiento (faltantes o desvíos a documentar)

| # | Gap | Severidad | Detalle |
|---|---|---|---|
| G1 | **Menú sin CTE `WITH RECURSIVE`** | Media (desvío justificado) | La celda "CRÍTICO" de §9 y §4.2 piden CTE vía ORM; el código arma el árbol en memoria (`menus.service.ts:59-94`). Cumple rendimiento/anti-N+1, pero no la técnica literal. Limitación real de Prisma. Conviene justificarlo por escrito ante el docente. |
| G2 | **Desasignar rol hace soft-delete, no físico** | Baja (contradicción del PDF) | `roles.service.ts:161-171`. Contradice la celda de la tabla §9 pero cumple la política global y la Nota #3. Documentar la decisión. |
| G3 | **Sin Global Scope/soft-delete filter automático a nivel ORM** | Baja | Nota #2 recomienda un filtro global (`estado:ACTIVO`) por middleware/extension; se hace manual en cada query (`prisma.service.ts` sin middleware). Consistente hoy, pero frágil ante nuevos endpoints que olviden el filtro. |
| G4 | **Rutas admin base declaradas estáticas en el frontend** | Baja | `router/index.ts:24-42` declara users/roles/modules/menus/external-services de forma estática. §5.4 pide "sin rutas hardcodeadas". La inyección dinámica (`dynamic-routes.ts`) sí existe y cubre módulos/servicios provisionados, y el Sidebar se pinta desde el árbol del rol; el intent del requisito (navegación extensible dirigida por el Master) se cumple, pero las vistas base no son 100% dinámicas. |
| G5 | **`GET /api/auth/public-key` inservible para validación offline con JWE** | Informativo | `auth.controller.ts:28-34` expone la clave pública, pero como los tokens son JWE cifrados con esa misma pública, el hijo necesitaría la **privada** para descifrar → la "validación asimétrica sin comunicación directa" (§6.1 opción b) no es viable con este diseño. Se usa la opción (a), que es válida. El endpoint queda vestigial. |
| G6 | **Sin hooks de ciclo de vida del ORM (Nota #1)** | Informativo | No hay `@BeforeInsert/@BeforeUpdate`; se cubre con atributos de schema + `whitelist` de DTO. Efecto equivalente, no idéntico a lo sugerido. |
| G7 | **`url` no forzado solo-en-hojas** | Informativo | §3 (tabla Menú) dice "url solo se completa en nodos hoja"; el schema/DTO no lo valida (de hecho el frontend permite padres clicables). Desvío menor y deliberado. |

---

### Veredicto global
Cobertura **muy alta** de los requisitos: los 5 objetivos específicos, la totalidad de los ~23 endpoints mínimos, el estándar de auditoría/soft-delete (incluidas las 3 tablas pivote), Zero Trust, menor privilegio, Argon2, anti-inyección por ORM, y todo el Anexo DevSecOps (pipeline, SAST doble, deploy por CLI, Telegram). Los dos desvíos de fondo (G1 menú sin CTE, G2 desasignar soft vs. físico) están **técnicamente justificados** y en el caso de G2 resuelven una contradicción interna del propio enunciado. Los demás gaps son menores o informativos.
