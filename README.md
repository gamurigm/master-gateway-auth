# Master Gateway - Autenticacion y Autorizacion Centralizada

Microservicio maestro full-stack que centraliza autenticacion, autorizacion basada en roles y construccion dinamica de menus para un ecosistema de microservicios con enfoque Zero Trust.

## Stack

| Capa | Tecnologia |
| --- | --- |
| Backend | NestJS + TypeScript |
| ORM | Prisma |
| BD | PostgreSQL 16 |
| Frontend | Angular + Angular CLI + Angular Router |
| Servicio hijo | Node.js + TypeScript |
| Seguridad | JWT, Argon2, Guards, DTO Validation, Helmet, rate limiting |
| Infra | Docker Compose, GitHub Actions, SonarQube Community |

## Comenzar

Requisito de runtime: Node.js `24.15.0` o compatible con Angular 22 (`22.22.3+`, `24.15.0+` o `26.0.0+`).

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar variables de entorno
cp .env.example .env

# 3. Levantar base de datos
docker compose up -d postgres

# 4. Migration y seed
npm run prisma:migrate
npm run prisma:seed

# 5. Iniciar backend
npm run dev:backend

# 6. Iniciar frontend
npm run dev:frontend

# 7. Iniciar microservicio hijo de ejemplo
npm run dev:ventas
```

Si Docker corre dentro de WSL desde Windows, usa:

```powershell
wsl -e docker compose up -d postgres
```

## Estructura

```text
backend/
  prisma/          # Schema, migraciones y seed
  src/
    auth/          # Login, select-role, refresh, logout
    users/         # CRUD de usuarios
    roles/         # CRUD de roles y asignacion
    modules/       # CRUD de modulos
    menus/         # CRUD de menus y arbol recursivo
    common/        # Guards, decorators, DTOs
    config/        # Validacion de entorno
    prisma/        # Servicio Prisma
  test/            # Pruebas e2e
frontend/          # SPA Angular
services/
  ventas/          # Microservicio hijo Zero Trust de ejemplo
  inventario/      # Microservicio hijo Zero Trust para productos
docs/              # Documentacion y coleccion HTTP
```

## Funcionalidades clave

- Login con `tempToken` y seleccion obligatoria de rol antes del dashboard.
- JWT final con un solo rol activo (`accessToken` + `refreshToken`).
- Rotacion y deteccion de reuso en refresh tokens.
- CRUD de usuarios, roles, modulos y menus con soft delete.
- Arbol de navegacion recursivo (`GET /api/menus/tree`) segun rol.
- Endpoint interno `POST /api/internals/validate-token` para Zero Trust.
- Microservicios hijos `ventas` e `inventario` que validan tokens contra el Master.
- Auditoria en entidades con `creado_por` y `actualizado_por`.
- Endpoints protegidos con guards, validacion DTO y rate limiting.

## Endpoints principales

### Autenticacion

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Inicio de sesion |
| `POST` | `/api/auth/select-role` | Seleccion de rol de trabajo |
| `POST` | `/api/auth/refresh-token` | Rotar refresh token |
| `POST` | `/api/auth/logout` | Cerrar sesion |
| `POST` | `/api/internals/validate-token` | Validacion interna Zero Trust |

### Gestion

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/api/users` | Listar usuarios |
| `POST` | `/api/users` | Crear usuario |
| `GET` | `/api/roles` | Listar roles |
| `POST` | `/api/roles` | Crear rol |
| `GET` | `/api/modules` | Listar modulos |
| `POST` | `/api/modules` | Crear modulo |
| `GET` | `/api/menus/tree` | Arbol de menus por rol |
| `POST` | `/api/menus` | Crear menu |

### Microservicios hijos

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `http://localhost:3006/health` | Health de ventas |
| `GET` | `http://localhost:3006/ventas/ordenes` | Ordenes protegidas por token |
| `GET` | `http://localhost:3007/health` | Health de inventario |
| `GET` | `http://localhost:3007/inventario/productos` | Productos protegidos por token |

## Seed

```bash
npm run prisma:seed
```

Crea: admin, rol admin, modulo Administracion y menus iniciales.

Credenciales demo:

- Email: `admin@example.com`
- Password: `Admin12345!`

## Pruebas

```bash
npm test
npm run test:e2e -w backend
npm run test:ventas
npm run test -w inventario
```

## CodeBERT SAST dockerizado

El pipeline incluye un analisis ML/SAST con CodeBERT en un contenedor propio.
Como Docker esta en WSL, ejecuta desde PowerShell:

```powershell
wsl sh -lc 'docker compose --profile security build codebert-sast'
wsl sh -lc 'docker compose --profile security run --rm codebert-sast'
```

El reporte se genera en:

```text
reports/codebert-sast.json
```

El modelo por defecto es `mrm8488/codebert-base-finetuned-detect-insecure-code`, un CodeBERT fine-tuned para deteccion de codigo inseguro. Ver detalles en `docs/codebert-sast.md`.
## SonarQube local

El mismo `sonarqube:community` se levanta de forma temporal dentro del job de
GitHub Actions para analizar `main` y bloquear el despliegue si falla el Quality
Gate. SonarQube Cloud no forma parte del workflow.

```powershell
wsl -e docker compose up -d sonar-db sonarqube
$env:SONAR_HOST_URL = "http://localhost:9000"
$env:SONAR_TOKEN = "<token-generado-en-sonarqube>"
npm run test:coverage
npm run sonar:scan
```

Si quieres usar el SonarQube que ya existe en WSL en `9090`, cambia `SONAR_HOST_URL` a `http://localhost:9090`.

## Documentacion

- `docs/adr/` - Registro de decisiones tecnicas.
- `docs/endpoints.md` - Endpoints disponibles y roles requeridos.
- `docs/seguridad.md` - Controles implementados y riesgos pendientes.
- `docs/ci-cd.md` - CI/CD local con SonarQube Community y GitHub Actions.
- `docs/zero-trust-ventas.md` - Integracion del microservicio hijo.
- `docs/master-gateway.http` - Coleccion HTTP para probar la API.
- `PLAN_IMPLEMENTACION_MASTER_GATEWAY.md` - Plan detallado de implementacion.

## Licencia

UNLICENSED - Proyecto academico ESPE.

