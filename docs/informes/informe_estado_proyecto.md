# Informe de Estado del Proyecto: Master Gateway de Autenticación y Autorización

Estado del proyecto frente a los requisitos de
[`proyectoIII.md`](../requisitos/proyectoIII.md) y su anexo de infraestructura.
Actualizado tras cerrar las fases de agente SAST, seeds, diagramas, registro de
microservicios externos y Kubernetes.

## Estado general: **Funcionalmente completo**

Stack real: **NestJS + Prisma + PostgreSQL** en el backend, **Vue 3** en el
frontend (SPA con nginx), microservicio hijo **ventas** bajo Zero Trust, y un
pipeline **GitHub Actions** con SonarQube, SAST CodeBERT y despliegue a Render.

> El frontend Angular (`frontend/`) quedó como legado; el activo es
> `frontend-vue/`. Sólo se conserva por compatibilidad y debe retirarse.

## 1. Requisitos funcionales — implementados

| Requisito (PDF) | Estado | Dónde |
| --- | --- | --- |
| Modelo M:N Usuarios–Roles con tabla pivote auditada | ✅ | `schema.prisma`, `usuario_roles` |
| Menús recursivos en una tabla (Adjacency List) | ✅ | `menus` con `parent_id`; árbol en `menus.service.ts` |
| CRUD de Identidad, Módulos y Menús | ✅ | `users`, `roles`, `modules`, `menus` |
| Pantalla de selección de rol (Workspace Selector) | ✅ | `SelectRoleView.vue` |
| Login en dos fases (tempToken → accessToken) | ✅ | `auth.service.ts` |
| Enrutamiento basado en menú, **sin rutas hardcodeadas** | ✅ | `router/dynamic-routes.ts`, `router.addRoute()` |
| Registro dinámico de microservicios externos | ✅ | `external-services/` + wizard en Vue |
| Zero Trust: el hijo valida cada token contra el Master | ✅ | `POST /internals/validate-token`, `services/ventas` |
| Menor privilegio: el token lleva sólo el rol elegido | ✅ | `select-role` emite JWE por rol |

## 2. Requisitos no funcionales y de seguridad — implementados

| Requisito | Estado | Notas |
| --- | --- | --- |
| Hash de contraseñas robusto | ✅ | `argon2id` (más fuerte que bcrypt) |
| Token de acceso | ✅ | **JWE cifrado (`dir`/`A256GCM`)**, no sólo firmado |
| Refresh token con rotación + detección de reúso | ✅ | `refresh_tokens` con `jti`, hash argon2id |
| Consultas parametrizadas (anti-inyección) | ✅ | Prisma ORM en todo el acceso a datos |
| Soft delete + campos de auditoría | ✅ | `estado`, `creado_por`, `actualizado_por` en todas las entidades |
| Rate limiting, Helmet, sanitización | ✅ | `@nestjs/throttler`, `helmet`, `@Sanitize` |
| Secrets fuera del código | ✅ | `.env` + `${VAR:?}` en compose; Secrets en K8s |
| SAST Shift-Left con modelo tipo CodeBERT | ✅ | `security/codebert-sast` con mapeo **CWE + OWASP 2025** |
| Defensa SSRF en el probe de servicios externos | ✅ | `ssrf-guard.ts` (CWE-918) |

## 3. DevSecOps — implementado

- Pipeline `.github/workflows/ci-cd.yml`: build → self-test del agente SAST →
  SonarQube Quality Gate → SAST CodeBERT → deploy a Render por CLI.
- **Agente SAST**: emite CWE, categoría OWASP Top 10 : 2025, línea, evidencia,
  CVEs de referencia y remediación. Reporte JSON + Markdown. 13 fixtures
  vulnerables + 3 seguros validan recall (100%) y falsos positivos (0).
- **Telegram**: notifica inicio de pipeline en main, Quality Gate, alerta SAST
  detallada (con CWE) y resultado del despliegue.
- **Kubernetes**: manifiestos Kustomize (`k8s/`), overlays dev/prod, probados en
  un cluster real (minikube). Escalado horizontal validado con claves RSA
  compartidas vía Secret.

## 4. Desviaciones documentadas (no son deuda, son decisiones)

1. **Árbol de menús en memoria, no con `WITH RECURSIVE`.** Una consulta plana +
   ensamblado en JS evita el N+1, es portable y no dispara la propia regla
   `TS-RAW-PRISMA` del SAST. Cumple el requisito de rendimiento de §6.4. Ver
   `docs/modelo-datos.md`.
2. **SonarQube Community efímero, no SonarCloud.** El pipeline levanta un
   contenedor de Sonar en CI en vez de usar el servicio cloud.

## 5. Pendiente (menor)

- Retirar el frontend Angular legado (`frontend/`) del workspace, del
  `docker-compose.yml` y de `sonar-project.properties`.
- Rotar los secretos que estuvieron en el historial de git de `docker-compose.yml`.
- Migrar el almacenamiento de tokens del frontend de `localStorage` a cookies
  `HttpOnly` (endurecimiento anti-XSS).
- Autorización granular por permiso/menú (hoy el CRUD administrativo se limita
  por rol `ADMIN`).
- Blacklist temporal de `jti` de access tokens para invalidación inmediata.

## 6. Verificación

- Backend: **84 pruebas unitarias + 7 e2e** en verde.
- Agente SAST: self-test **16/16**, escaneo del repo **SAFE** (0 críticos).
- Builds de backend, ventas y frontend-vue correctos.
- Despliegue en Kubernetes: 5 componentes sanos, health + conexión a PostgreSQL
  OK, y validación de token entre 3 réplicas **12/12**.

Diagramas: `docs/diagramas-secuencia.md` (5 flujos) y
`docs/arquitectura_alto_nivel.md` (componentes + modelo ER).
