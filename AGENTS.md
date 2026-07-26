
## DATOS DEL PROYECTO

**Nombre:** Master Gateway - Autenticación y Autorización Centralizada
**Contexto:** Proyecto académico integrador de la materia "Desarrollo de Software Seguro", Universidad de las Fuerzas Armadas ESPE.
**Propósito:** Microservicio maestro full-stack que centraliza autenticación, autorización basada en roles y construcción dinámica de menús para un ecosistema de microservicios, siguiendo Zero Trust y Shift-Left.
**Ubicación:** `C:\Users\gamur\Documents\ESPE VII SI 2026\Desarrollo Seguro\U3\p`
**Sistema operativo:** Windows (PowerShell 5.1)
**Docker:** Se usa via WSL con `wsl -e docker compose ...`
**Frontend activo:** Solo Vue 3 (el Angular es legacy, no cubrirlo)
**Audiencia del AGENTS.md:** opencode (asistente AI CLI)
**Nivel de detalle:** Muy detallado

## ARQUITECTURA

Usuario/Browser → Kong API Gateway (:8000) → Master Gateway NestJS (:3000) → PostgreSQL 16
                                                                      → OPA Policy Engine (:8181)
                                                                      → Child Services (Ventas :3006, Inventario :3007)

### Stack tecnológico

- Runtime: Node.js 24.15.0 (fijado en .nvmrc y .node-version)
- Backend: NestJS ^11.0.1 con TypeScript 5.9.3
- ORM: Prisma ^6.0.0 con PostgreSQL 16 (Alpine)
- Frontend: Vue 3 + Vite 8 + Pinia 4 + Vue Router 4 + Axios + Lucide icons
- API Gateway: Kong 3.8 + Konga UI
- Policy: OPA (Open Policy Agent) con Rego
- Auth: JWE (A256GCM) + JWT via jose ^5.10.0
- Passwords: Argon2id
- Validación: class-validator + class-transformer
- Seguridad HTTP: Helmet ^8.0.0
- Rate limiting: @nestjs/throttler ^6.5.0

### Módulos del backend (NestJS)

- AuthModule — Login 2-pasos (tempToken → select-role → accessToken), refresh con rotación y detección de reuso
- UsersModule — CRUD con soft delete (estado=INACTIVO)
- RolesModule — CRUD + asignación de usuarios/módulos/menús/permisos
- ModulesModule — CRUD de módulos del sistema
- MenusModule — CRUD con árbol recursivo (adjacency list), filtrado por rol
- PermissionsModule — Catálogo de permisos
- TicketsModule — Sistema de tickets vía SSE
- PolicyModule — Integración OPA para autorización fina
- PrismaModule — Servicio de base de datos
- ConfigModule — Validación de entorno al arranque

### Frontend (Vue 3)

- main.ts → Pinia stores (auth, menu) + Vue Router
- Servicios en frontend-vue/src/services/ (api.ts, auth.service.ts, etc.)
- Vistas en frontend-vue/src/views/ (LoginView, DashboardView, CRUD views, etc.)
- Vite dev en puerto 4200 con proxy a backend:3000

### Microservicios child (Zero Trust)

- services/ventas/ y services/inventario/ — Sin DB local, validan tokens contra Master via POST /api/internals/validate-token
- Usan x-internal-api-key + x-internal-service headers

## ENFOQUE SHIFT-LEFT (controles de seguridad implementados)

### SAST

- CodeBERT ML-powered SAST en security/codebert-sast/ (Python 3.12 + PyTorch + Transformers)
- Escanea con modelo mahdin70/CodeBERT-PrimeVul-BigVul (mejor para JS/TS)
- Reporte en reports/codebert-sast.json con CWE + OWASP 2025
- Threshold configurable (default 0.999 para TS)
- Integrado en CI/CD

### SonarQube

- SonarQube Community en GitHub Actions (efímero)
- Quality Gate bloquea deploy si no pasa
- sonar-project.properties configurado
- Se ejecuta solo en main

### Otros controles

- ValidationPipe global (whitelist, forbidNonWhitelisted, transform)
- Helmet + CORS restringido
- Rate limiting global (120/60s) y específico (login: 5/60s)
- Argon2id para passwords
- JWT con issuer, audience, expiration, jti
- Refresh token rotation con reuse detection (family revocation)
- Internal API key + allowlist para endpoints internos
- Soft delete en todas las entidades
- Validación de entorno al arranque (rechaza change-me-* en prod)
- Claves RSA validadas al arranque (módulo ≥3072 bits)

## HALLAZGOS CRÍTICOS Y ALTOS DE SEGURIDAD (NO REINTRODUCIR)

### C-1: Bypass total de autenticación

- JWE encriptado con RSA public key que está EXPUESTA (public.pem en backend/keys/)
- Cualquiera puede forjar tokens válidos
- RESTRICCIÓN: NO exponer public.pem en producción, NO permitir que la clave pública sea accesible públicamente

### C-2: Secretos reales en historial git

- INTERNAL_API_KEY, JWT_SECRET commiteados
- RESTRICCIÓN: NO commitear .env, NO commitear keys/*.pem, usar .gitignore, rotar cualquier secreto expuesto

### A-1: SSRF via TOCTOU/DNS rebinding

- Endpoint POST /external-services/probe hace requests salientes
- RESTRICCIÓN: NO modificar ssrf-guard.ts sin entender DNS rebinding, mantener bloqueo de IPs privadas

### A-2: Stored XSS via menu :href

- Menú puede tener href malicioso
- RESTRICCIÓN: Validar y sanitizar href en creación/actualización de menús

### A-3: Tokens en localStorage (7 días)

- Frontend guarda tokens en localStorage
- RESTRICCIÓN: NO eliminar el interceptor que inyecta tokens, considerar migración a cookies HttpOnly

### A-4: Deploy branches bypassing security gates

- Branches deploy/render-test y deploy/frontend-test bypassan CI
- RESTRICCIÓN: NO pushear a estas branches sin ejecutar CI completo

### A-5: Race condition en refresh token rotation

- Múltiples refresh simultáneos pueden invalidar familia entera
- RESTRICCIÓN: NO modificar lógica de refresh token sin entender el patrón de family revocation

## ESTRUCTURA DE DIRECTORIOS CLAVE

/
├── backend/
│   ├── src/
│   │   ├── main.ts                    # Entry point
│   │   ├── app.module.ts              # Módulo raíz
│   │   ├── auth/                      # Autenticación
│   │   ├── users/                     # CRUD usuarios
│   │   ├── roles/                     # CRUD roles + asignaciones
│   │   ├── modules/                   # CRUD módulos
│   │   ├── menus/                     # CRUD menús + árbol
│   │   ├── permissions/               # Catálogo permisos
│   │   ├── tickets/                   # Sistema SSE tickets
│   │   ├── external-services/         # Registro + probe + ssrf-guard
│   │   ├── common/
│   │   │   ├── auth/                  # Guards, decorators, JWT/JWE
│   │   │   ├── keys/                  # RSA key management
│   │   │   ├── policy/                # OPA integration
│   │   │   ├── decorators/            # Sanitize decorator
│   │   │   ├── dto/                   # Pagination DTO
│   │   │   └── utils/                 # omit-password, etc.
│   │   └── config/                    # Env validation
│   ├── prisma/
│   │   ├── schema.prisma              # DB schema (8 modelos)
│   │   ├── seed.ts                    # Seed script
│   │   └── migrations/
│   └── test/                          # E2E tests
├── frontend-vue/
│   ├── src/
│   │   ├── main.ts                    # Entry point
│   │   ├── router/                    # Vue Router + rutas dinámicas
│   │   ├── services/                  # API services (Axios)
│   │   ├── stores/                    # Pinia stores
│   │   ├── views/                     # 18 vistas
│   │   └── types/                     # TypeScript types
│   └── vite.config.ts
├── services/
│   ├── ventas/                        # Child microservice
│   └── inventario/                    # Child microservice
├── security/
│   ├── codebert-sast/                 # ML SAST scanner
│   └── opa/                           # Rego policies
├── scripts/                           # Deploy, test, config scripts
├── docs/                              # Documentación
├── reports/                           # SAST reports
├── .github/workflows/                 # CI/CD
├── docker-compose.yml                 # 15+ servicios
├── sonar-project.properties
├── .env.example
└── package.json                       # Workspace root

## COMANDOS PRINCIPALES

### Setup inicial

```bash
npm install                              # Instalar dependencias (workspaces)
cp .env.example .env                     # Configurar variables de entorno
npm run prisma:migrate                   # Ejecutar migraciones
npm run prisma:seed                      # Seed de datos iniciales
Desarrollo:
npm run dev:backend                      # NestJS en :3000
npm run dev:frontend                     # Vue+Vite en :4200
npm run dev:ventas                       # Ventas microservice en :3006
npm run dev:inventario                   # Inventario en :3007
Base de datos (requiere Docker):
wsl -e docker compose up -d postgres     # Solo PostgreSQL
Prisma:
npm run prisma:validate                  # Validar schema
npm run prisma:generate                  # Generar Prisma client
npm run prisma:migrate                   # Crear/ejecutar migración
npm run prisma:seed                      # Seed
Testing:
npm test                                 # Todos los tests
npm run test:backend                     # Solo backend (Jest)
npm run test:frontend                    # Solo frontend-vue
npm run test:ventas                      # Solo ventas
npm run test:e2e:local                   # E2E local
npm run test:coverage                    # Backend con cobertura
Linting & Build:
npm run lint                             # ESLint en backend + frontend + ventas
npm run build                            # Build completo
npm run build:backend                    # Solo backend
npm run build:frontend                   # Solo frontend-vue
SAST:
npm run sast:self-test                   # 16/16 fixtures (validar agente)
npm run sast:rules                       # Escanear solo con reglas (sin descargar modelo)
npm run sast:fixtures                    # Escanear fixtures vulnerables
# CodeBERT completo (descarga modelo ~1.5GB):
wsl sh -lc 'docker compose --profile security build codebert-sast'
wsl sh -lc 'docker compose --profile security run --rm codebert-sast'
CI/CD Local:
npm ci
npm run prisma:validate
npm run lint
npm run test
npm run test:e2e -w backend
npm run build
npm run test:coverage
npm run sonar:scan                        # Requiere SonarQube corriendo
SonarQube local:
wsl -e docker compose up -d sonar-db sonarqube   # Levantar SQ
$env:SONAR_HOST_URL = "http://localhost:9000"
$env:SONAR_TOKEN = "<token>"
npm run sonar:scan
Docker Compose completo:
wsl -e docker compose up -d                      # 15+ servicios
API Test script:
$env:API_URL="http://localhost:3000/api"
scripts/test-api.sh                               # Bash via WSL
ARCHIVOS A REVISAR POR ÁREA
Para entender autenticación:
- backend/src/auth/auth.service.ts
- backend/src/common/auth/jwt-auth.guard.ts
- backend/src/common/auth/jwe-token.ts
- backend/src/common/auth/jws-token.ts
- backend/src/common/auth/gateway-session.service.ts
- backend/src/common/keys/keys.service.ts
Para entender Zero Trust:
- services/ventas/src/server.ts
- backend/src/auth/auth.controller.ts (endpoint /internals/validate-token)
- docs/zero-trust-ventas.md
Para entender menú dinámico:
- backend/src/menus/menus.service.ts
- frontend-vue/src/router/dynamic-routes.ts
- frontend-vue/src/stores/menu.ts
Para entender OPA/policy:
- security/opa/authz.rego
- backend/src/common/policy/policy.service.ts
- backend/src/common/policy/policy.guard.ts
Para entender SAST/CodeBERT:
- security/codebert-sast/codebert_sast.py
- docs/codebert-sast.md
- reports/codebert-sast.json
Para entender CI/CD:
- .github/workflows/ci-cd.yml (o ci.yml)
- docs/ci-cd.md
Para entender la base de datos:
- backend/prisma/schema.prisma
- docs/modelo-datos.md
Para entender seguridad/SSRF:
- backend/src/external-services/ssrf-guard.ts
- docs/seguridad.md
- INFORME_AUDITORIA_SEGURIDAD.md
DOCUMENTACIÓN DE REFERENCIA
- docs/arquitectura_alto_nivel.md — Diagrama de componentes + flujo
- docs/diagramas-secuencia.md — Diagramas de secuencia
- docs/adr/0001-stack.md — Decisiones técnicas
- docs/endpoints.md — Endpoints y roles requeridos
- docs/seguridad.md — Controles, SSRF, gestión de claves RSA
- docs/codebert-sast.md — SAST: CWE/OWASP, fixtures, criterios
- docs/ci-cd.md — CI/CD local y GitHub Actions
- docs/zero-trust-ventas.md — Integración Zero Trust
- docs/master-gateway.http — Colección HTTP para pruebas
- docs/render-deploy.md — Deploy en Render
- docs/modelo-datos.md — Modelo de datos
- PLAN_IMPLEMENTACION_MASTER_GATEWAY.md — Plan de implementación
- INFORME_AUDITORIA_SEGURIDAD.md — Auditoría de seguridad completa
RESTRICCIONES Y REGLAS
 1. NUNCA commitees archivos .env, keys/*.pem, o cualquier secreto
 2. NUNCA modifiques la lógica de refresh token rotation sin entender family revocation
 3. NUNCA expongas public.pem en producción (C-1)
 4. NUNCA pushees a deploy/render-test o deploy/frontend-test sin CI completo
 5. NUNCA deshabilites guards, validación DTO, o rate limiting
 6. NUNCA almacenes tokens en algo que no sea localStorage sin entender las implicaciones (A-3)
 7. NUNCA modifiques ssrf-guard.ts sin entender DNS rebinding
 8. Siempre valida y sanitiza href en menús (A-2)
 9. Node version debe ser 24.15.0 (ver .nvmrc)
10. Usa npm workspaces: los sub-paquetes están en backend/, frontend-vue/, services/ventas/
11. Los scripts de npm corren con -w <workspace> para apuntar a sub-paquetes
12. Para Docker en Windows, usa siempre wsl -e docker compose ... (no docker compose directo)
13. Para comandos bash (test-api.sh), ejecuta via wsl
FORMATO DEL ARCHIVO AGENTS.MD
Genera el archivo en la raíz del proyecto como AGENTS.md (en español, consistente con el proyecto). Usa formato claro con secciones, tablas, y ejemplos de código. El tono debe ser directo y técnico, orientado a un asistente AI.
Incluye AL MENOS estas secciones:
 1. Resumen del proyecto (propósito, arquitectura, stack)
 2. Cómo empezar (setup, dev, build)
 3. Comandos esenciales (tabla con todos los npm scripts útiles)
 4. Pruebas (unit, e2e, coverage)
 5. SAST y análisis de seguridad
 6. CI/CD
 7. Arquitectura de módulos
 8. Convenciones de código (NestJS modules, DTOs, Guards, etc.)
 9. Archivos clave por área
10. Seguridad: restricciones y hallazgos (críticos y altos)
11. Referencias a documentación
12. Troubleshooting común
```
