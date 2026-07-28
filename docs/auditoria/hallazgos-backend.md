# Auditoría de seguridad — Backend NestJS "Master Gateway"

Alcance: revisión estática (solo lectura) de `backend/src`, `backend/prisma` y config de despliegue (`k8s/`, `docker-compose.yml`). Fecha: 2026-07-24.

> El forjado de token JWE (clave pública expuesta en `GET /api/auth/public-key` sin guard + JWE solo cifrado, no firmado) YA está confirmado y no se repite aquí, salvo por sus **consecuencias derivadas** (ver C0). El resto son hallazgos independientes.

---

## C0. Consecuencia derivada del forjado: radio de impacto a los microservicios hijos

- **Severidad:** Crítico (derivado)
- **Archivo:** `backend/src/auth/auth.service.ts:299-311` (`validateInternal`) · `backend/src/auth/auth.controller.ts:67-74`
- **Riesgo:** `POST /api/internals/validate-token` descifra el token y devuelve `{ valid, userId, roleId, roleName }` a los servicios hijos (p. ej. `ventas`, que autoriza con `VENTAS_ALLOWED_ROLES: "ADMIN,VENTAS"`). Como el access token es forjable, la autorización de **todos** los servicios que confían en el Master queda comprometida, no solo la del Gateway.
- **Escenario:** El atacante forja un token con `roleName:'ADMIN'` (o `'VENTAS'`), lo envía al servicio de ventas; ventas llama a `validate-token`, el Master responde `valid:true, roleName:'ADMIN'` y ventas concede acceso.
- **Fix:** Firmar los tokens (JWS/JWE anidado o access token como JWT RS256 con la privada) y verificar autenticidad; el `validate-token` debe validar firma, no solo descifrado.

---

## H1. SSRF por DNS rebinding / TOCTOU en el probe (la validación de IP y la conexión usan resoluciones DNS distintas)

- **Severidad:** Alto
- **Archivo:** `backend/src/external-services/ssrf-guard.ts:125-149` (resuelve y valida la IP) → `backend/src/external-services/external-services.service.ts:74` (valida) y `:78`→`:338-346` (`fetchWithTimeout` hace `fetch(target)` con el **hostname**, no con la IP validada). Mismo patrón en `discoverEndpoints` `:301-302`.
- **Riesgo:** `assertSafeProbeTarget` hace `dns.lookup(hostname)` y comprueba la IP resuelta, pero después `fetch(target)` vuelve a resolver el hostname por su cuenta. La comprobación (check) y el uso (use) están desacoplados: la IP que se valida no es necesariamente la IP a la que se conecta. El comentario del guard solo cubre el caso simple (un dominio que resuelve fijo a 127.0.0.1), no el TOCTOU.
- **Escenario:** El atacante (admin real, o cualquiera vía token forjado) registra un dominio con TTL 0 cuyo servidor DNS responde una IP pública en la primera consulta (pasa la validación) y `169.254.169.254` (metadatos de nube) o una IP interna en la segunda (la de `fetch`). El Master hace la petición saliente al destino prohibido y devuelve `statusCode`, `latencyMs`, `resolvedAddress` y el cuerpo OpenAPI → exfiltración de credenciales de instancia / acceso a la red interna.
- **Fix:** Resolver una sola vez y **fijar** la conexión a esa IP: pasar un `lookup`/`Agent` personalizado a `fetch`/undici que reutilice la IP ya validada, o validar dentro del callback de `lookup`. Mantener `redirect:'manual'` (ya está).

## H2. Condición de carrera en la rotación de refresh token (consumo no atómico → se anula la detección de reúso)

- **Severidad:** Alto (medio si el refresh no está robado; alto porque anula un control central del diseño)
- **Archivo:** `backend/src/auth/auth.service.ts:145-238` (lecturas `147-213`, emisión `215-219`, revocación del viejo `221-228`) — sin transacción ni bloqueo.
- **Riesgo:** Entre el `findUnique` (147) y el `update` que revoca el token (221) hay varios `await` sin atomicidad. Dos peticiones concurrentes con el mismo refresh token pasan ambas las comprobaciones (incluida la de reúso en `164-185`, que ve `revokedAt=null`) antes de que cualquiera revoque → se emiten **dos** familias de tokens válidas de un solo token y la detección de reúso **no** se dispara.
- **Escenario:** Un refresh token robado se usa en paralelo con el legítimo; ambos obtienen sesión nueva sin matar la familia → el atacante mantiene una sesión persistente e indetectada. Variante de fiabilidad: un SPA que dispara dos refresh a la vez (retry/StrictMode) se auto-invalida o duplica sesión.
- **Fix:** Consumo atómico condicional: `updateMany({ where: { id, estado: ACTIVO, revokedAt: null }, data: {...revocado} })` y comprobar `count === 1` **antes** de emitir; o `$transaction` con `SELECT ... FOR UPDATE` / aislamiento serializable. Emitir el nuevo token solo si el CAS del viejo tuvo éxito.

---

## M1. Confusión de tipo de token: el refresh token se acepta como access token

- **Severidad:** Medio
- **Archivo:** `backend/src/common/auth/jwt-auth.guard.ts:31-37` · `backend/src/common/auth/jwe-token.ts:11-17` · emisión sin claim de tipo en `backend/src/auth/auth.service.ts:360-394`.
- **Riesgo:** Access token y refresh token son JWE con la **misma** estructura (`sub, jti, roleId, roleName`), mismo `alg/enc/iss/aud`; solo difieren en la expiración (15m vs 7d). `JwtAuthGuard` descifra y acepta cualquier "gateway token" no expirado con `iss/aud` válidos → un refresh token (7 días) funciona como Bearer en cualquier endpoint protegido. No hay claim `typ`/`token_use`.
- **Escenario:** Un cliente (o atacante con un refresh robado) usa el refresh token de 7 días directamente en `Authorization: Bearer` y obtiene acceso durante 7 días donde el diseño asume 15 minutos; además el refresh acaba en cabeceras/logs de acceso.
- **Fix:** Añadir claim `token_use: 'access'|'refresh'` en la emisión y que `JwtAuthGuard` exija `access` y `verifyRefreshToken` exija `refresh`.

## M2. Autorización solo por nombre de rol; el modelo de permisos (módulos/menús) nunca se aplica en el servidor

- **Severidad:** Medio
- **Archivo:** `backend/src/common/auth/roles.guard.ts:16-33` (compara `requiredRoles.includes(roleName)`) · todos los controllers con `@RequireRoles('ADMIN')` · único consumidor de RoleModule/RoleMenu: `backend/src/menus/menus.service.ts:32-95` (`treeForRole`, solo para pintar el menú).
- **Riesgo:** Toda la autorización real es el string literal `'ADMIN'` tomado del claim del token. Las tablas `RoleModule`/`RoleMenu` (todo el "sistema de permisos") no gobiernan ningún acceso a API: solo alimentan el árbol de menús del frontend. Consecuencias: no hay mínimo privilegio, no se puede delegar acceso parcial, la frontera de autorización es un único claim controlado por el token, y esto amplifica el forjado (basta `roleName:'ADMIN'`). Tampoco se revalida contra BD que el rol/usuario sigan activos.
- **Fix:** Autorización basada en permisos: derivar permisos efectivos del rol (RoleModule/RoleMenu o una tabla de permisos) y comprobarlos por endpoint; no confiar en un nombre de rol embebido. Revalidar estado del usuario/rol para operaciones sensibles.

## M3. Sin revocación de access token; usuarios/roles desactivados conservan acceso

- **Severidad:** Medio
- **Archivo:** `backend/src/common/auth/jwt-auth.guard.ts:31-37` (confía en el payload sin ninguna consulta a BD).
- **Riesgo:** El guard nunca comprueba en BD que el `sub` siga `ACTIVO`, que la asignación `UserRole` siga vigente, ni que el token no haya sido revocado (no hay lista de bloqueo de `jti` para access tokens). Un usuario desactivado o cuyo rol se desasignó sigue operando hasta que expire el token (15 min de access, o **7 días** combinado con M1).
- **Escenario:** Se desactiva a un empleado (`estado=INACTIVO`); su access token (o su refresh usado como access, M1) sigue funcionando durante la vida del token.
- **Fix:** TTL de access corto + comprobación de revocación/estado (usuario y rol activos) en operaciones sensibles; lista de bloqueo de `jti` o versión de sesión.

## M4. Gestión de claves RSA: reúso de clave para firma y cifrado + autogeneración frágil en arranque

- **Severidad:** Medio
- **Archivo:** `backend/src/common/keys/keys.service.ts:29-71` (autogenera si no existen) · `backend/src/auth/auth.module.ts:14-32` (tempToken RS256 con la MISMA clave) · `backend/src/auth/auth.service.ts:354-357` (JWE RSA-OAEP con la misma pública).
- **Riesgo:** (a) El mismo par RSA se usa para **firmar** el tempToken (RS256) y para **cifrar** los tokens de sesión (RSA-OAEP-256): reutilizar clave entre firma y cifrado es un antipatrón criptográfico. (b) Si no hay ficheros de clave, cada réplica genera su **propio** par al arrancar → tokens emitidos por una réplica no descifran en otra (rompe la sesión en despliegue escalado); además hay TOCTOU (`existsSync` → `generateKeys`) si comparten volumen. (c) En FS efímero (contenedores) un reinicio regenera claves e invalida todas las sesiones. (d) Sin `kid` no hay rotación sin downtime.
- **Nota:** En k8s se monta un Secret compartido (mitiga b/c), pero la ruta de fallback sigue siendo peligrosa y el reúso de clave permanece.
- **Fix:** Pares distintos para firma y cifrado (o firmar en vez de solo cifrar); prohibir autogeneración en producción (fallar si faltan claves); introducir `kid` y rotación.

## M5. Credenciales de administrador por defecto conocidas + contraseña impresa en logs (seed)

- **Severidad:** Medio
- **Archivo:** `backend/prisma/seed.ts:54-56` (defaults `admin@example.com` / `Admin12345!`, `Demo12345!`) y `:126` (imprime `demoPassword` en claro) · `docker-compose.yml` (`SEED_ADMIN_PASSWORD: ${SEED_ADMIN_PASSWORD:-Admin12345!}`).
- **Riesgo:** Si no se sobreescriben `SEED_ADMIN_*`, el admin desplegado usa una contraseña **publicada en el repositorio**. El seed además vuelca la contraseña demo en claro por stdout (queda en logs del orquestador). `env.validation` no cubre estos valores (rechaza `change-me`, no `Admin12345!`).
- **Escenario:** Despliegue en Render/compose sin override → login con `admin@example.com` / `Admin12345!`. Independiente del forjado.
- **Fix:** Exigir `SEED_ADMIN_PASSWORD` (sin default) y forzar cambio en primer login; no imprimir contraseñas; validar fuerza.

## M6. Protección anti-SSRF desactivada por defecto en la base de k8s (`ALLOW_PRIVATE_PROBE_TARGETS: "true"` con `NODE_ENV=production`)

- **Severidad:** Medio
- **Archivo:** `k8s/base/configmap.yaml:23` (=`"true"`, con `NODE_ENV:"production"` en `:7`) · solo `k8s/overlays/prod/kustomization.yaml:42-48` lo pone en `"false"`; el overlay `dev` **no** lo sobreescribe (hereda `"true"`).
- **Riesgo:** El estado seguro depende de recordar el patch en cada overlay. Un `apply` de la base o del overlay `dev` corre el probe **sin ninguna** defensa SSRF (se saltan todas las listas de bloqueo en `ssrf-guard.ts:134-138`), etiquetado como producción. Combinado con el forjado, cualquiera obtiene un escáner/proxy SSRF completo hacia la red del clúster y metadatos.
- **Fix:** Invertir el default: base en `"false"` y que solo el entorno interno controlado lo habilite explícitamente. Documentar egress controlado.

---

## L1. Enumeración de usuarios por canal lateral de tiempo en login

- **Severidad:** Bajo
- **Archivo:** `backend/src/auth/auth.service.ts:64` (`!user || !(await argon2.verify(...))` — cortocircuita el verify si el usuario no existe).
- **Riesgo:** Email inexistente → respuesta rápida (sin argon2); email existente con clave mala → lenta (argon2). Diferencia de tiempo medible = enumeración de cuentas (CWE-208). Mitigado por throttle 5/min.
- **Fix:** Verificar siempre contra un hash dummy cuando el usuario no exista.

## L2. Comparación de la API key interna no es de tiempo constante

- **Severidad:** Bajo
- **Archivo:** `backend/src/auth/auth.service.ts:277` (`apiKey !== expectedKey`).
- **Riesgo:** Comparación de string dependiente de datos (CWE-208); canal lateral de tiempo sobre `INTERNAL_API_KEY`. Difícil por red pero es una debilidad reconocida.
- **Fix:** `crypto.timingSafeEqual` sobre buffers de longitud fija (hashear ambos lados antes de comparar).

## L3. Sanitizador de HTML naíf: falsa sensación de seguridad y corrupción de datos

- **Severidad:** Bajo
- **Archivo:** `backend/src/common/decorators/sanitize.decorator.ts:13-17` (`value.replace(/<[^>]*>/g,'')`).
- **Riesgo:** Quitar `<...>` no es defensa XSS (la defensa es el escapado en salida, que Angular ya hace) y da falsa confianza; además muta silenciosamente entradas legítimas que contengan `<` (p. ej. apellidos), afectando integridad.
- **Fix:** Tratarlo solo como normalización; confiar en el escapado de Angular y, si se requiere HTML, usar una librería vetada (DOMPurify) en el punto de render.

## L4. Mass assignment latente por `data: { ...dto }` en varios services

- **Severidad:** Bajo (hoy contenido, frágil)
- **Archivo:** `backend/src/roles/roles.service.ts:122` · `backend/src/modules/modules.service.ts:44,52` · `backend/src/external-services/external-services.service.ts:153,166`.
- **Riesgo:** Se esparce el DTO directo a Prisma. Hoy es seguro **solo** porque los DTOs son estrictos y el `ValidationPipe` global usa `whitelist + forbidNonWhitelisted`. Si alguien añade un campo a un DTO (p. ej. `estado`, `moduleId`, `createdBy`) o se relaja el pipe, pasa a ser asignable por el cliente.
- **Fix:** Mapear campos explícitamente (como ya hacen `users.service` y `menus.service`).

## L5. Actualizaciones sin pre-chequeo de unicidad → 500 (P2002) / fuga de error

- **Severidad:** Bajo
- **Archivo:** `backend/src/users/users.service.ts:76-93` (email) · `backend/src/roles/roles.service.ts:118-124` (name) · `backend/src/modules/modules.service.ts:48-54` (code).
- **Riesgo:** `create` valida unicidad, pero `update` no; un valor duplicado lanza Prisma P2002 servido como 500 (peor UX/DoS puntual y, en no-prod, posible traza).
- **Fix:** Pre-chequear unicidad excluyendo el propio id y devolver 409; capturar P2002 en un filtro de excepciones global.

## L6. `provision` acepta rutas protocol-relative (`//host`) como URL de menú

- **Severidad:** Bajo
- **Archivo:** `backend/src/external-services/dto/provision-service.dto.ts:25` (`/^\/[\w\-./:]*$/`).
- **Riesgo:** `path` puede ser `//attacker.com` (dos barras superan `\/` + resto permitido) y se persiste como `url` de menú; si el SPA lo usa para navegar/redirigir es un open-redirect/phishing. El `:` permitido a media ruta amplía la superficie.
- **Fix:** Regex que exija una sola barra inicial y prohíba `//` y `:`; validar como ruta relativa estricta.

## L7. Sin longitud máxima de contraseña → DoS de CPU por argon2

- **Severidad:** Bajo
- **Archivo:** `backend/src/auth/dto/login.dto.ts:9-11` · `backend/src/users/dto/create-user.dto.ts:15-20` (y update).
- **Riesgo:** `MinLength` sin `MaxLength`; una contraseña muy larga (hasta el límite de body ~100kb) se hashea con argon2id (coste CPU) → vector de DoS. Acotado por el body limit y el throttle de login.
- **Fix:** `@MaxLength(128)` en contraseñas.

## L8. CORS/env: `main.ts` lee `process.env` directamente y hace fallback a localhost en producción

- **Severidad:** Bajo
- **Archivo:** `backend/src/main.ts:16-20` (`process.env.FRONTEND_ORIGIN ?? 'http://localhost:4200'`) · `backend/src/config/env.validation.ts:18-23` (no exige `FRONTEND_ORIGIN` en prod).
- **Riesgo:** `main.ts` no usa el `ConfigService` validado; si `FRONTEND_ORIGIN` no está seteado con `NODE_ENV=production`, el CORS cae a `http://localhost:4200`. No es wildcard (no fuga credenciales a orígenes arbitrarios) pero es config frágil. Nota general: buena parte del runtime lee `process.env` directo (Prisma, KeysService parcial, `INTERNAL_*` en auth.service), puenteando los defaults de `validateEnv`; afortunadamente esas rutas fallan cerradas.
- **Fix:** Leer siempre desde `ConfigService`; exigir `FRONTEND_ORIGIN` en producción en `validateEnv`.

## L9. Permisos del fichero de clave privada dependientes del SO

- **Severidad:** Bajo (informativo)
- **Archivo:** `backend/src/common/keys/keys.service.ts:62` (`mode: 0o600`).
- **Riesgo:** En el host Windows de desarrollo el `private.pem` aparece como `-rw-r--r--` (los modos POSIX se ignoran en Windows; rigen las ACL NTFS). En prod la clave viene de un Secret k8s montado (riesgo menor), pero en cualquier despliegue sobre FS de host conviene verificar ACLs.
- **Fix:** Asegurar permisos/ACL del secreto por plataforma; no depender solo de `mode`.

---

## Aspectos correctos / valor agregado

- **Hashing robusto:** argon2id para contraseñas (`users.service`, `seed`) y para el refresh token en reposo (`auth.service.ts:403`). Los refresh tokens se guardan hasheados, no en claro.
- **Rotación de refresh con detección de reúso:** revoca toda la familia `userId+roleId` al detectar reúso (`auth.service.ts:164-185`). Buen diseño (solo debilitado por la carrera H2).
- **SSRF guard bien pensado** (`ssrf-guard.ts`): valida sobre la **IP resuelta**, bloquea rangos IPv4/IPv6 privados/loopback/link-local/metadatos, cubre IPv4-mapped-IPv6 en forma decimal **y** hex (evita bypass conocido), rechaza credenciales embebidas y protocolos no http(s). En el fetch: `redirect:'manual'` (evita SSRF por redirección), cap de cuerpo (512KB), timeout (5s) y throttle estricto propio en `/probe`. (Debilidades: TOCTOU H1 y el default de M6.)
- **Higiene de entrada global:** `ValidationPipe` con `whitelist + forbidNonWhitelisted + transform`; `ParseUUIDPipe({version:'4'})` en todos los `:id` (mitiga IDOR por id malformado y confusión de tipos); DTOs con `class-validator` estrictos y límites de longitud/regex.
- **Hardening HTTP:** `helmet()`, throttling global (120/min) y por endpoint con `blockDuration` en login/select-role/refresh/probe; `etag` deshabilitado.
- **Persistencia parametrizada:** Prisma en todo el dominio; el único SQL crudo es `SELECT 1` constante en el health (`app.service.ts:14`) — sin superficie de inyección.
- **Logging seguro:** estructurado, con email hasheado en login fallido (`auth.service.ts:434-439`), `x-request-id` saneado por allowlist regex (evita log/header injection), y `omitPassword` para no exponer `passwordHash` en respuestas.
- **Config:** `validateEnv` rechaza secretos `change-me` bajo producción; claves y `.env` correctamente en `.gitignore` (verificado: no versionados). `internals/validate-token` con defensa en profundidad (chequeo incondicional de API key + allowlist de servicios).
- **Integridad de datos:** soft-delete (`estado`) filtrado consistentemente; bloqueo de baja de rol con usuarios activos asignados (`roles.service.ts:128-140`); detección de ciclos en jerarquía de menús (`menus.service.ts:178-196`); `provision` envuelto en `$transaction`.
- **IDOR:** el modelo es admin-scope con ids UUIDv4; no hay propiedad por-usuario que violar en estos endpoints, por lo que no hay IDOR clásico explotable dentro del modelo actual.
