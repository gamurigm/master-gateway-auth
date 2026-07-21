# Master Gateway - Autenticacion y Autorizacion Centralizada

Microservicio maestro full-stack que centraliza autenticacion, autorizacion basada en roles y construccion dinamica de menus para un ecosistema de microservicios con enfoque Zero Trust.

## Stack

| Capa          | Tecnologia                                                                  |
| ---------------| -----------------------------------------------------------------------------|
| Backend       | NestJS + TypeScript                                                         |
| ORM           | Prisma                                                                      |
| BD            | PostgreSQL 16                                                               |
| Frontend      | Vue 3 + Vue Router (SPA, rutas dinámicas)                                   |
| Servicio hijo | Node.js + TypeScript                                                        |
| Seguridad     | JWE (A256GCM), Argon2id, Guards, DTO Validation, Helmet, rate limiting      |
| Infra         | Docker Compose, Kubernetes (Kustomize), GitHub Actions, SonarQube Community |

## Comenzar

Requisito de runtime: Node.js `24.15.0` (o `22.22.3+` / `26.0.0+`).

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

### Puertos

| Servicio | Desarrollo (`npm run dev`) | Docker Compose (host) |
| --- | --- | --- |
| Backend (Master) | `3000` | `3000` (`BACKEND_PORT`) |
| Frontend Vue (SPA) | `4200` (Vite) | `4201` (`FRONTEND_VUE_PORT`) |
| Frontend Angular (legado) | — | `4200` (`FRONTEND_PORT`) |
| Microservicio ventas | `3006` | `3006` (`VENTAS_PORT`) |
| PostgreSQL | — | `5443` → `5432` |
| SonarQube | — | `9000` |

En desarrollo, Vite sirve el SPA en `4200` y proxya `/api` hacia el backend en
`http://localhost:3000` (ver `frontend-vue/vite.config.ts`). En Docker Compose el
SPA Vue queda en `4201` porque el `4200` lo ocupa el frontend Angular legado.

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
    external-services/ # Registro de micros externos (probe anti-SSRF, provisión)
    common/        # Guards, decorators, DTOs
    config/        # Validacion de entorno
    prisma/        # Servicio Prisma
  test/            # Pruebas e2e
frontend-vue/      # SPA Vue 3 (activa)
frontend/          # SPA Angular (legado)
services/
  ventas/          # Microservicio hijo Zero Trust de ejemplo
security/
  codebert-sast/   # Agente SAST (CWE + OWASP 2025)
  fixtures/        # Código vulnerable/seguro para validar el agente
k8s/               # Manifiestos Kubernetes (Kustomize, overlays dev/prod)
docs/              # Documentacion, diagramas y coleccion HTTP
```

## Funcionalidades clave

- Login con `tempToken` y seleccion obligatoria de rol antes del dashboard.
- JWT final con un solo rol activo (`accessToken` + `refreshToken`).
- Rotacion y deteccion de reuso en refresh tokens.
- CRUD de usuarios, roles, modulos y menus con soft delete.
- Arbol de navegacion recursivo (`GET /api/menus/tree`) segun rol.
- Endpoint interno `POST /api/internals/validate-token` para Zero Trust.
- Microservicio hijo `ventas` que valida tokens contra el Master.
- Auditoria en entidades con `creado_por` y `actualizado_por`.
- Endpoints protegidos con guards, validacion DTO y rate limiting.

## Endpoints principales

### Autenticacion

| Metodo | Ruta                            | Descripcion                   |
| --------| ---------------------------------| -------------------------------|
| `POST` | `/api/auth/login`               | Inicio de sesion              |
| `POST` | `/api/auth/select-role`         | Seleccion de rol de trabajo   |
| `POST` | `/api/auth/refresh-token`       | Rotar refresh token           |
| `POST` | `/api/auth/logout`              | Cerrar sesion                 |
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

### Microservicio ventas

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `http://localhost:3006/health` | Health del hijo |
| `GET` | `http://localhost:3006/ventas/ordenes` | Ordenes protegidas por token |

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
```

## CodeBERT SAST dockerizado

El pipeline incluye un analisis ML/SAST con CodeBERT en un contenedor propio.
Como Docker esta en WSL, ejecuta desde PowerShell:

```powershell
wsl sh -lc 'docker compose --profile security build codebert-sast'
wsl sh -lc 'docker compose --profile security run --rm codebert-sast'
```

Los reportes se generan en `reports/codebert-sast.json` (con `cwe_id`,
`owasp_2025`, línea, CVEs de referencia y remediación por hallazgo) y
`reports/codebert-sast.md` (informe legible).

En CI se usa el modelo `mahdin70/CodeBERT-PrimeVul-BigVul` (entrenado sobre
BigVul + PrimeVul). El agente mapea cada hallazgo a su **CWE** y a su categoría
en el **OWASP Top 10 : 2025**. Para probarlo contra código deliberadamente
vulnerable:

```bash
npm run sast:selftest    # 16/16 casos: recall 100%, 0 falsos positivos
npm run sast:rules       # escanea el repo sólo con reglas, sin descargar pesos
```

Ver detalles en `docs/codebert-sast.md`.
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

## Kubernetes

Manifiestos Kustomize en `k8s/` (base + overlays `dev`/`prod`), probados en
minikube. Incluye el detalle que habilita el escalado horizontal: las claves RSA
se comparten entre réplicas vía Secret montado, en vez de autogenerarse por pod.

```bash
kubectl apply -k k8s/overlays/dev
```

Guía completa (build de imágenes, carga en el cluster, smoke test y prueba de
escalado) en `k8s/README.md`.

## Documentacion

- `docs/arquitectura_alto_nivel.md` - Diagrama de componentes + modelo ER.
- `docs/diagramas-secuencia.md` - Los flujos clave en diagramas de secuencia.
- `docs/adr/` - Registro de decisiones tecnicas.
- `docs/endpoints.md` - Endpoints disponibles y roles requeridos.
- `docs/seguridad.md` - Controles implementados, defensa SSRF y riesgos pendientes.
- `docs/codebert-sast.md` - Agente SAST: CWE/OWASP, fixtures y criterios de fallo.
- `docs/ci-cd.md` - CI/CD local con SonarQube Community y GitHub Actions.
- `docs/zero-trust-ventas.md` - Integracion del microservicio hijo.
- `docs/master-gateway.http` - Coleccion HTTP para probar la API.
- `k8s/README.md` - Despliegue en Kubernetes.
- `PLAN_IMPLEMENTACION_MASTER_GATEWAY.md` - Plan detallado de implementacion.

## Licencia

UNLICENSED - Proyecto academico ESPE.

## Integrantes

-   **Camilo Orrico** 
-   **Cesar Loor**
-   **Gabriel Murrillo** :)
