# Informe de Auditoría — Master Gateway (Proyecto Integrador Parcial III)

**Fecha:** 2026-07-24 · **Rama auditada:** `dev-cesar` (`921d72d`) · **Alcance:** backend NestJS, frontend Vue 3, microservicio `ventas`, infraestructura y CI/CD.
**Método:** revisión de código en 4 frentes en paralelo + verificación manual (PoC) de los hallazgos graves.

---

## 1. Veredicto ejecutivo

El proyecto es **funcionalmente muy completo y ambicioso**: cubre los 5 objetivos específicos, la totalidad de los ~23 endpoints mínimos, el estándar de auditoría/soft-delete (incluidas las 3 tablas pivote), el flujo Zero Trust con un microservicio hijo real, y todo el anexo DevSecOps (pipeline con gates que **sí** bloquean el deploy, SAST propio con self-test, Kubernetes endurecido, Telegram). En cumplimiento formal del enunciado, está **por encima de lo pedido**.

Pero tiene **un fallo criptográfico crítico que anula la garantía central del sistema** (la autenticación) y **una fuga de secretos reales en el historial de git**. Es decir: cumple el requisito "en la forma", pero la seguridad efectiva está rota en la raíz. Ambos son corregibles sin rediseñar.

> **Paradoja a explicar ante el docente:** el sistema *formalmente* cumple "Zero Trust / token en cada endpoint / menor privilegio", pero la implementación deja forjar ese token a cualquiera. La nota de seguridad debe leerse con esa salvedad.

| | |
|---|---|
| 🔴 Críticos | 2 |
| 🟠 Altos | 6 |
| 🟡 Medios | 13 |
| ⚪ Bajos | ~18 (agrupados) |

**Orden de remediación:** C-1 → C-2 → A-1..A-6 → medios. Los dos críticos son bloqueantes para cualquier despliegue real.

---

## 2. Lo que pide el enunciado vs. avance (cumplimiento)

Cobertura **alta**. Resumen (detalle completo en `scratchpad/cumplimiento-pdf.md`):

| Bloque | Estado | Nota |
|---|---|---|
| OE1 M:N Usuarios–Roles con pivote auditada | ✅ Cumple | `usuario_roles` con `@@unique` y auditoría |
| OE2 Menús recursivos en 1 tabla (Adjacency List) por rol | ✅ Cumple | `parent_id`; árbol filtrado por rol |
| OE3 Workspace Selector (login → elegir rol → dashboard) | ✅ Cumple | no se puede saltar la selección de rol |
| OE4 Arquitectura para hijos; Master emite/valida tokens | ✅ Cumple (forma) | **pero ver C-1**: la validación es forjable |
| OE5 Tests, sanitización, anti-SQLi por ORM, hash | ✅ Cumple | Argon2id, Prisma parametrizado, 13 spec + e2e |
| ~23 endpoints mínimos (§9) | ✅ Cumple | todos presentes con el prefijo `/api` |
| Auditoría + soft-delete en TODAS las entidades y pivotes | ✅ Cumple | ningún `delete()` físico en el código |
| Menú vía CTE `WITH RECURSIVE` | 🟨 Se desvía (justificado) | lo hace en memoria (1 query, sin N+1); Prisma no soporta CTE recursiva nativa |
| Desasignar rol = "eliminación física" (§9) | 🟨 Se desvía (justificado) | hace soft-delete, coherente con la política global; **el propio PDF se contradice** aquí |
| Menor privilegio: token solo con el rol elegido | ✅ en el token / ❌ en el server | el payload lleva solo 1 rol, pero **el server no aplica permisos por módulo/menú** (ver M-1) |

**Dos desvíos de fondo (menú CTE y desasignar físico) están técnicamente bien justificados** y conviene documentarlos explícitamente en la entrega; el segundo incluso resuelve una contradicción interna del enunciado.

---

## 3. Valor agregado (por encima del enunciado)

- **Rotación de refresh tokens con detección de reúso** y revocación en cascada de la familia (patrón OWASP). El enunciado solo pedía "revocación si se detecta reutilización".
- **Microservicio hijo `ventas` real y bien hecho**: Zero Trust *fail-closed* (Master caído → 503, token inválido → 401, rol no permitido → 403), revalida en **cada** request, deriva el rol de la respuesta del Master (no del cliente), con reintentos para el "sleep" del PaaS. Tiene su propio test.
- **Módulo `external-services`**: da de alta un servicio hijo, comprueba su salud (`probe`) y **autogenera** módulo + menús + asignaciones (`provision`) → ecosistema extensible sin tocar código, con guard anti-SSRF.
- **SAST propio con self-test**: valida su propio detector (16/16 fixtures) *antes* de confiar en el veredicto; enriquece con CWE + OWASP 2025 + CVEs y **redacta secretos** antes de mandarlos a Telegram.
- **Kubernetes endurecido de verdad**: `runAsNonRoot`, `drop:[ALL]`, `NetworkPolicy` default-deny, probes, HPA, y la clave RSA **montada desde Secret compartido** (no autogenerada por pod) — justo el criterio de HA que pedía el anexo.
- **Los gates de CI bloquean el deploy** (no son decorativos): cadena `needs:` + `exit 1` + `gate_status=='OK'` bien construida.
- JWE **cifrado** (confidencialidad de claims), rate-limiting por endpoint, Helmet, logging estructurado con email hasheado, `omitPassword` en serialización.

---

## 4. Hallazgos de seguridad priorizados

### 🔴 C-1 · Bypass total de autenticación y autorización (forjado de tokens)
**OWASP A02 Cryptographic Failures / A01 Broken Access Control · CWE-347 · Verificado con PoC funcional.**

Los access/refresh tokens se emiten como **JWE cifrado** con `alg: RSA-OAEP-256` usando la clave **pública** RSA ([auth.service.ts:354-376](backend/src/auth/auth.service.ts)), y esa clave se sirve **sin protección** en `GET /api/auth/public-key` ([auth.controller.ts:28-34](backend/src/auth/auth.controller.ts)). En RSA-OAEP **la clave que cifra es la pública** → cualquiera que la descargue puede fabricar un token válido.

- Cifrar ≠ firmar. Un JWE da *confidencialidad*, no *autenticidad del emisor*. Para autenticar hace falta una **firma** (JWS con la clave privada), no cifrado con la pública.
- **PoC confirmado**: con solo la clave pública del repo forjé un token con `roleName:"ADMIN"` y `decryptGatewayToken()` (lo que usa `JwtAuthGuard`) lo aceptó. `RolesGuard` entonces concede acceso total al CRUD.
- **Radio de impacto (C0):** `POST /api/internals/validate-token` devuelve ese `roleName` a los hijos, así que el forjado **también rompe la autorización de `ventas`** y de cualquier futuro microservicio. La frontera Zero Trust cae entera.
- **Causa raíz:** el commit `921d72d "fix: use RSA keys for JWE tokens"` cambió el access token de `alg:'dir'` (clave **simétrica secreta**, seguro) a `RSA-OAEP-256` (clave pública), y el refresh de JWS RS256 (firmado, seguro) a lo mismo. Confundieron *validación asimétrica de firma* (lo que pide el PDF §6.1.b) con *cifrado asimétrico*.

**Fix (elegir uno):**
1. **Recomendado** — firmar el access token con **JWS RS256/EdDSA** (`new SignJWT().sign(privateKey)`); los hijos verifican con la pública (`jwtVerify`). Eso es exactamente la "validación asimétrica sin comunicación con el Master" del PDF, y ahí sí la clave pública puede ser pública. Si además quieren cifrar el payload, hacer *nested* (sign-then-encrypt) con una clave que **no** se publique.
2. Volver a **JWE `dir` + clave simétrica secreta** (como antes de `921d72d`). Es seguro contra forjado externo, pero entonces **no** se puede dar la clave a los hijos → estos validan por `POST /internals/validate-token` (opción "validación directa", que ya funciona).

En cualquier caso: **quitar o no exponer** `GET /api/auth/public-key` mientras el esquema sea de cifrado.

---

### 🔴 C-2 · Secretos reales de producción en el historial de git (`origin/main`)
**OWASP A05/A07 · Verificado: 7 commits en `origin/main` contienen los secretos.**

`docker-compose.yml` commiteó valores reales, recuperables hoy desde `origin/main` (commits `3490d75`, `a4029bb`, `c0be76e`, `277ef1e`, …). Variables comprometidas:

`INTERNAL_API_KEY`, `JWT_SECRET`, `JWE_SECRET`, `TEMP_JWT_SECRET`, `REFRESH_JWT_SECRET`, `SEED_ADMIN_PASSWORD`.

- El commit `c0be76e` ("saca los secretos…") **no purgó el historial**; solo los movió del archivo. Su propio mensaje admite "los valores siguen en el historial y deben ROTARSE". Sigue sin hacerse.
- `INTERNAL_API_KEY` filtrada = cualquiera puede hacerse pasar por servicio interno ante `/api/internals/*`. Combinado con C-1, el Zero Trust es papel.
- Severidad: **Crítica si el repositorio es o fue público**; Alta si es estrictamente privado. En ambos casos hay que actuar.

**Fix:** rotar **las 6** en GitHub Secrets + Render/entorno **ya**; luego purgar historial (`git filter-repo`/BFG) o asumir la fuga como definitiva. `INTERNAL_API_KEY` primero.

---

### 🟠 A-1 · SSRF por TOCTOU / DNS rebinding en el probe
**CWE-918 · Verificado en código.** [external-services.service.ts:74-78](backend/src/external-services/external-services.service.ts)
`assertSafeProbeTarget()` valida la **IP resuelta**, pero luego `fetch(target)` usa el **hostname** ([:339](backend/src/external-services/external-services.service.ts)) → **segunda resolución DNS**. Un dominio con TTL 0 devuelve IP pública al validar y `169.254.169.254`/IP interna al conectar. El guard bloquea redirecciones pero no la doble resolución.
**Fix:** resolver una vez y **fijar la conexión a esa IP** (lookup/agent custom con la IP ya validada y `Host` original).

### 🟠 A-2 · XSS almacenado vía `:href` de menú (+ A-3) → toma de cuenta
**OWASP A03 · CWE-79 · Verificado.** [MenuItem.vue:11-13](frontend-vue/src/components/MenuItem.vue)
El enlace externo hace `:href="node.url"` **sin validar protocolo**; Vue no sanea `javascript:`. Un menú con `url="javascript:…"` se vuelve ejecutable al hacer clic. Inconsistencia clara: [DynamicPageView.vue:52-55](frontend-vue/src/views/DynamicPageView.vue) **sí** exige `^https?://`; `MenuItem` lo olvidó.
**Fix:** validar `^https?:` (o `/app/`) antes de renderizar el `<a>`, reutilizando la comprobación de `DynamicPageView`.

### 🟠 A-3 · Tokens en `localStorage` (7 días)
**OWASP A07 · CWE-522.** [auth.service.ts:16-18](frontend-vue/src/services/auth.service.ts)
`accessToken`+`refreshToken` en `localStorage` → cualquier XSS (p.ej. A-2) los exfiltra; el refresh vive 7 días = acceso persistente. Es el eslabón que convierte A-2 en toma de cuenta completa.
**Fix:** mover el refresh a cookie `HttpOnly`+`Secure`+`SameSite`; mantener el access en memoria.

### 🟠 A-4 · Ruta de despliegue que evade TODOS los gates
[.github/workflows/deploy-render-test.yml](.github/workflows/deploy-render-test.yml) (+ `deploy-frontend-test.yml`)
Push a `deploy/render-test` dispara `render deploys create --confirm --wait` **sin build, tests, Sonar ni SAST**, contra el service real. El nombre "test" engaña: toca producción y saltea el Shift-Left entero.
**Fix:** branch protection o eliminar esos workflows; que el único camino a prod sea el pipeline con gates.

### 🟠 A-5 · Carrera en la rotación de refresh token
[auth.service.ts:145-238](backend/src/auth/auth.service.ts)
Entre el `findUnique` y el `update` de revocación **no hay transacción ni bloqueo**. Dos peticiones concurrentes con el mismo token pasan ambas la comprobación de reúso (ven `revokedAt=null`) → **dos familias válidas y la detección de reúso no se dispara**.
**Fix:** consumo atómico condicional: `updateMany(where estado=ACTIVO & revokedAt=null)` y comprobar `count===1` antes de emitir.

### 🟠 A-6 · `docker-compose.yml` (HEAD) arranca como "producción" con credenciales conocidas
[docker-compose.yml:113,122,125](docker-compose.yml)
`NODE_ENV: production` fijo + `${INTERNAL_API_KEY:-local-docker-internal-key}` + `${SEED_ADMIN_PASSWORD:-Admin12345!}`. El endurecimiento a `${VAR:?}` de `c0be76e` fue **revertido** en HEAD. `env.validation.ts` solo rechaza `change-me*`, no estos literales. Incluye el default débil de `INTERNAL_API_KEY` del hijo `ventas` ([server.ts:32](services/ventas/src/server.ts)).
**Fix:** volver a `${VAR:?}` y ampliar `validateEnv` para rechazar también estos literales en prod.

---

### 🟡 Medios (resumen)

| # | Hallazgo | Dónde | Fix breve |
|---|---|---|---|
| M-1 | **Autorización solo por nombre de rol**; `RoleModule`/`RoleMenu` **nunca** se aplican en el server (solo alimentan el menú del front) → no hay menor privilegio real | `roles.guard.ts:28`, `menus.service.ts` | aplicar permisos por módulo/menú en un guard, no solo `@RequireRoles('ADMIN')` |
| M-2 | Sin revocación de access token: usuario/rol desactivado conserva acceso hasta `exp` | `jwt-auth.guard.ts:31-37` | blocklist de `jti` o chequeo de estado en BD |
| M-3 | Confusión de tipo de token: el refresh (7d) sirve como access | `auth.service.ts:360-394` | claim `token_use` y verificarlo en el guard |
| M-4 | **Kong Admin API en `0.0.0.0:8001` sin auth**, publicada al host | `docker-compose.yml:71,76` | escuchar en loopback/red interna |
| M-5 | Claves RSA: reúso firma/cifrado, autogeneración divergente entre réplicas, sin `kid`/rotación; en Render se regeneran por instancia e invalidan sesiones | `keys.service.ts:29-71` | claves separadas por uso, montadas desde Secret también en Render |
| M-6 | CodeBERT con `trust_remote_code=True` sin `revision` fijada → **RCE supply-chain en CI** | `codebert_sast.py:499,504` | fijar `revision=<sha>`, idealmente `trust_remote_code=False` |
| M-7 | El SAST **no escanea** `docker-compose.yml`/`k8s`/`.env`/`scripts` → no habría cazado C-2 | `ci-cd.yml:384,386` | incluir config y scripts en el escaneo |
| M-8 | Ningún workflow declara `permissions:` → `GITHUB_TOKEN` con permisos amplios | `.github/workflows/*` | `permissions: contents: read` top-level |
| M-9 | `// sast-ignore: RULE` silencia hallazgos sin reportarlos | `codebert_sast.py:740-764` | listar los suprimidos con justificación |
| M-10 | Guard del front solo mira **presencia** de token (no `exp` ni rol); 401/refresh fallido no limpia sesión | `router/index.ts:49`, `api.ts:63-78` | decodificar `exp`, y en refresh fallido → logout+redirect |
| M-11 | Dependencia vulnerable **`fast-uri` (high) en producción** | `package-lock.json` | `npm audit fix` |
| M-12 | Anti-SSRF **desactivado por defecto** en overlay k8s `dev` (hereda `ALLOW_PRIVATE_PROBE_TARGETS:"true"`) | `k8s/base/configmap.yaml:23` | overlay dev debe fijarlo en `false` salvo necesidad explícita |
| M-13 | `ventas` valida contra el Master **sin timeout/AbortController** dentro de 3 reintentos → amplificación de DoS | `services/ventas/src/server.ts:72-97` | `AbortController` 3-5s manteniendo fail-closed |

### ⚪ Bajos (agrupados)
- **Backend:** enumeración de usuarios por *timing* en login (`auth.service.ts:64`); comparación no constante de la API key interna (usar `timingSafeEqual`); sanitizador HTML naíf que corrompe datos (`sanitize.decorator.ts`); *mass assignment* latente por `data:{...dto}` (hoy contenido por DTOs estrictos); `P2002` servido como 500 en updates; `provision` acepta URLs protocol-relative `//host` (open-redirect); sin `MaxLength` en password (DoS de CPU por argon2); `FRONTEND_ORIGIN` no exigido en prod (cae a `localhost:4200`).
- **Infra:** inyección en `$GITHUB_ENV` vía mensaje de commit con línea `EOF` (impacto acotado a Telegram); `backend/Dockerfile` y `ventas/Dockerfile` corren como **root** en runtime; config muerta (el deploy inyecta JWE/JWT secrets que el script ya no usa tras migrar a RSA); tags flotantes (`konga:latest`); `dev-cesar` cableada en el workflow; `/health` de `ventas` abierto (sin bypass de auth de negocio).
- **Front:** `InventoryView` hace `fetch` crudo sin `Authorization`; `url` de menú sin saneo de charset (mitigado: el componente destino es siempre `DynamicPageView`, no hay carga por nombre arbitrario).

---

## 5. Optimización, rendimiento y calidad

- **Menú (rendimiento):** el árbol en memoria (1 query + ensamblado en JS) **cumple** el objetivo anti-N+1 del §6.4; no es un defecto. Solo documentar por qué no se usó `WITH RECURSIVE` (límite de Prisma).
- **Resiliencia:** el `fetch` sin timeout de `ventas` (M-13) es el punto de rendimiento a corregir — bajo carga o con el Master "despertando", amplifica latencia ×3.
- **Consistencia de datos:** la falta de transacción en la rotación de refresh (A-5) es también un problema de correctitud, no solo de seguridad.
- **Mantenibilidad:** el filtro `estado:ACTIVO` es manual en cada query (sin *Global Scope*/middleware Prisma) → frágil ante endpoints nuevos que lo olviden. Considerar una extensión de cliente Prisma.
- **Deuda declarada:** retirar el frontend Angular legado (`frontend/`) del workspace, `docker-compose.yml` y `sonar-project.properties`.

---

## 6. Plan de remediación (orden sugerido)

1. **C-1** — Firmar el access token (JWS RS256) en lugar de cifrarlo con la pública; dejar de exponer `public-key` mientras tanto. *(Bloqueante.)*
2. **C-2** — Rotar los 6 secretos filtrados (empezando por `INTERNAL_API_KEY`) y purgar/asumir el historial. *(Bloqueante.)*
3. **A-4** — Cerrar las ramas de deploy que saltan los gates.
4. **A-1 / A-5** — Fijar IP en el probe SSRF; hacer atómica la rotación de refresh.
5. **A-2 + A-3** — Validar protocolo en `MenuItem`; mover el refresh a cookie `HttpOnly`.
6. **A-6** — Volver a `${VAR:?}` y endurecer `validateEnv`.
7. **M-1..M-13** — En especial M-1 (permisos reales en el server) y M-6/M-7 (endurecer el propio pipeline SAST).

---

## Anexos (detalle por frente)
- [docs/auditoria/hallazgos-backend.md](docs/auditoria/hallazgos-backend.md) — cripto y autorización.
- [docs/auditoria/hallazgos-frontend-ventas.md](docs/auditoria/hallazgos-frontend-ventas.md) — SPA y microservicio hijo.
- [docs/auditoria/hallazgos-devsecops.md](docs/auditoria/hallazgos-devsecops.md) — CI/CD, Docker, k8s, secretos.
- [docs/auditoria/cumplimiento-pdf.md](docs/auditoria/cumplimiento-pdf.md) — cumplimiento requisito por requisito.
