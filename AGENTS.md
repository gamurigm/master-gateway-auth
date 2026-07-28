# AGENTS.md

## Environment

This workspace assumes the following CLI tools are installed and available in PATH.

### Search

- fd
- rg
- fzf

### File inspection

- bat
- eza
- tree

### Data processing

- jq
- yq

### Git

- git
- gh

### Containers

- docker
- docker compose
- dive
- trivy

### Kubernetes

- kubectl
- helm
- k9s

### Build

- make
- cmake
- just

---

# Preferred command policy

Always prefer the following tools over legacy commands.

## Finding files

Preferred

```bash
fd <pattern>
```

Avoid

```bash
find
dir /s
Get-ChildItem -Recurse
```

---

## Searching text

Preferred

```bash
rg "pattern"
```

Avoid

```bash
grep -R
findstr
Select-String
```

---

## Listing directories

Preferred

```bash
eza -la
eza --tree
```

Avoid

```bash
ls
dir
```

---

## Viewing files

Preferred

```bash
bat file.ts
```

Avoid

```bash
cat
type
more
```

---

## JSON

Preferred

```bash
jq
```

Never manually parse JSON with grep or regex.

---

## YAML

Preferred

```bash
yq
```

Never manually parse YAML.

---

## GitHub

Prefer

```bash
gh
```

instead of opening GitHub manually.

---

## Kubernetes

Prefer

```bash
kubectl
helm
```

Use

```bash
jq
```

for JSON output.

Use

```bash
yq
```

for manifests.

---

## Docker

Inspect images using

```bash
dive
```

Security scans using

```bash
trivy
```

---

## Interactive selection

Whenever selecting one file from many, use

```bash
fd . | fzf
```

---

# Code Search

Use ripgrep whenever code understanding is needed.

Examples

```bash
rg "UserService"

rg "JwtModule"

rg "TODO"

rg "FIXME"

rg "Controller"

rg "interface"
```

---

# Large repositories

Never recursively open folders.

Instead

1. Locate files with fd.
2. Search symbols with rg.
3. Read files with bat.
4. Inspect tree using eza.

---

# Performance

Prefer commands that stream output.

Avoid recursive scans unless necessary.

Never parse command output using fragile regex if jq or yq can be used.

---

# Security

Use

```bash
trivy image
```

before recommending Docker images.

Prefer official images.

Avoid downloading binaries from unknown sources.

---

# Git workflow

Prefer

```bash
gh pr
gh issue
gh repo
```

instead of browser operations.

---

# Output

Keep terminal output concise.

Avoid huge recursive listings.

Limit displayed files to relevant results.

---

# 1. Resumen del Proyecto

Este proyecto implementa un *Microservicio Master Gateway* encargado de centralizar:

- Autenticación
- Autorización
- Gestión de Usuarios
- Gestión de Roles
- Gestión de Módulos
- Gestión de Menús Dinámicos
- Workspace por Rol
- Validación Zero Trust
- Integración con futuros microservicios

Se desarrolla como parte del proyecto integrador de *Desarrollo de Software Seguro*.

La arquitectura sigue los principios de:

- Zero Trust
- Shift Left Security
- Clean Architecture
- Domain Driven Design (ligero)
- DevSecOps
- Stateless JWT Authentication

---

# 2. Stack Tecnológico

## Backend

- NestJS
- Prisma ORM
- PostgreSQL
- Passport
- JWT
- Argon2
- class-validator
- class-transformer

## Frontend

- Vue 3
- Vite
- Pinia
- Vue Router

## Seguridad

- JWT
- JWE
- JWS
- RSA
- OPA (Open Policy Agent)
- SSRF Protection
- Rate Limiting

## DevSecOps

- GitHub Actions
- SonarQube
- CodeBERT SAST
- Docker
- Render

---

# 3. Arquitectura General

text
                    +-----------------------+
                    |    Vue Frontend       |
                    +-----------+-----------+
                                |
                                |
                                ▼
                   +-------------------------+
                   |   Master Gateway        |
                   |      NestJS API         |
                   +-----------+-------------+
                               |
        +----------------------+----------------------+
        |                      |                      |
        ▼                      ▼                      ▼
 Authentication           Authorization         Dynamic Menu
 JWT / JWE              OPA + Guards           Recursive Tree

    |
        ▼

 PostgreSQL (Prisma)

    |
        ▼

---

Zero Trust
----------

Ventas -----------+
Inventario -------+---- validate-token()
RRHH -------------+
Finanzas ---------+

---

# 4. Flujo de Autenticación

text
Login

↓

POST /auth/login

↓

TempToken

↓

Usuario selecciona Rol

↓

POST /auth/select-role

↓

JWT definitivo

↓

Frontend almacena JWT

↓

Cada petición

↓

JwtAuthGuard

↓

PolicyGuard

↓

OPA

↓

Controller

↓

Service

↓

Prisma

↓

PostgreSQL

---

# 5. Flujo Zero Trust

text
Usuario

↓

Ventas

↓

Authorization: Bearer JWT

↓

POST /internals/validate-token

↓

Master Gateway

↓

JWT válido

↓

Role válido

↓

Ventas continúa

↓

Respuesta

---

# 6. Arquitectura del Repositorio

.
│
├── backend/
│   ├── prisma/
│   ├── src/
│   └── test/
│
├── frontend-vue/
│
├── services/
│   ├── ventas/
│   └── inventario/
│
├── security/
│   ├── codebert-sast/
│   └── opa/
│
├── scripts/
│
├── docs/
│
├── reports/
│
├── docker/
│
└── .github/

---

# 7. Responsabilidad de Cada Carpeta

## backend/

Responsable de:

- JWT
- JWE
- JWS
- Login
- Roles
- Usuarios
- Menús
- OPA
- Prisma
- Validación Zero Trust

---

## frontend-vue/

Responsable de:

- Login
- Workspace
- Menú dinámico
- Dashboard
- Rutas dinámicas

---

## services/

Contiene microservicios.

Actualmente:

- ventas
- inventario

Estos NO gestionan usuarios.

Siempre consultan al Master Gateway.

---

## security/

Contiene:

- OPA
- CodeBERT
- SAST
- Reglas
- Seguridad

---

## docs/

Toda la documentación técnica.

Debe mantenerse sincronizada con el código.

---

# 8. Cómo Empezar

## Instalar dependencias

bash
npm install

## Configurar variables

bash
cp .env.example .env

## Levantar PostgreSQL

bash
wsl -e docker compose up -d postgres

## Ejecutar migraciones

bash
npm run prisma:migrate

## Seed

bash
npm run prisma:seed

---

# 9. Desarrollo

Backend

bash
npm run dev:backend

Frontend

bash
npm run dev:frontend

Ventas

bash
npm run dev:ventas

Inventario

bash
npm run dev:inventario

---

# 10. Build

bash
npm run build

Backend

bash
npm run build:backend

Frontend

bash
npm run build:frontend

---

# 11. Testing

Todos

bash
npm test

Backend

bash
npm run test:backend

Frontend

bash
npm run test:frontend

Ventas

bash
npm run test:ventas

E2E

bash
npm run test:e2e:local

Cobertura

bash
npm run test:coverage

---

# 12. Prisma

Validar

bash
npm run prisma:validate

Generar Client

bash
npm run prisma:generate

Migraciones

bash
npm run prisma:migrate

Seed

bash
npm run prisma:seed

---

# 13. SAST

Self Test

bash
npm run sast:self-test

Rules

bash
npm run sast:rules

Fixtures

bash
npm run sast:fixtures

CodeBERT

bash
wsl sh -lc 'docker compose --profile security build codebert-sast'

wsl sh -lc 'docker compose --profile security run --rm codebert-sast'

---

# 14. SonarQube

Levantar

bash
wsl -e docker compose up -d sonar-db sonarqube

Variables

powershell
$env:SONAR_HOST_URL="[http://localhost:9000](http://localhost:9000)"

$env:SONAR_TOKEN="<token></token>"

Ejecutar

bash
npm run sonar:scan

---

# 15. Pipeline Local

Ejecutar SIEMPRE antes de hacer commit.

bash
npm ci

npm run prisma:validate

npm run lint

npm test

npm run test:e2e -w backend

npm run build

npm run test:coverage

npm run sast:rules

npm run sonar:scan

---

# 16. Convenciones de Código

Siempre:

- DTOs
- ValidationPipe
- Guards
- Prisma
- Dependency Injection
- async/await
- camelCase
- PascalCase para clases
- Tipado estricto

Nunca:

- any
- SQL manual
- lógica en Controllers
- consultas desde Controllers
- lógica de negocio en Guards

---

# 17. Flujo Correcto

Siempre

Controller

↓

DTO

↓

Guard

↓

PolicyGuard

↓

Service

↓

Repository (Prisma)

↓

Database

Nunca

Controller

↓

Prisma

---

# 18. Definición de Terminado (Definition of Done)

Una tarea NO está terminada hasta cumplir:

- [ ] Build exitoso
- [ ] Lint limpio
- [ ] Tests pasan
- [ ] Coverage actualizado
- [ ] Prisma validate
- [ ] Sin errores Sonar
- [ ] Sin errores SAST
- [ ] Documentación actualizada
- [ ] Endpoint probado
- [ ] Sin secretos expuestos

---

# 19. Archivos Clave por Área

## Autenticación

backend/src/auth/auth.service.ts

backend/src/common/auth/jwt-auth.guard.ts

backend/src/common/auth/jwe-token.ts

backend/src/common/auth/jws-token.ts

backend/src/common/auth/gateway-session.service.ts

backend/src/common/keys/keys.service.ts

## Zero Trust

services/ventas/src/server.ts

backend/src/auth/auth.controller.ts

docs/zero-trust-ventas.md

## Menús

backend/src/menus/menus.service.ts

frontend-vue/src/router/dynamic-routes.ts

frontend-vue/src/stores/menu.ts

## Policy

security/opa/authz.rego

backend/src/common/policy/policy.service.ts

backend/src/common/policy/policy.guard.ts

## Base de Datos

backend/prisma/schema.prisma

docs/modelo-datos.md

## Seguridad

backend/src/external-services/ssrf-guard.ts

docs/seguridad.md

INFORME_AUDITORIA_SEGURIDAD.md

---

# 20. Documentación

Leer en este orden:

1. docs/arquitectura_alto_nivel.md
2. docs/modelo-datos.md
3. docs/endpoints.md
4. docs/seguridad.md
5. docs/zero-trust-ventas.md
6. docs/codebert-sast.md
7. docs/ci-cd.md
8. docs/render-deploy.md
9. docs/diagramas-secuencia.md

---

# 21. Restricciones Críticas

NUNCA

- subir .env
- subir *.pem
- subir secretos
- deshabilitar Guards
- quitar DTOs
- quitar ValidationPipe
- modificar Refresh Rotation sin entender Family Revocation
- modificar SSRF Guard sin entender DNS Rebinding
- guardar JWT en otro sitio sin justificar
- hacer SQL manual
- hardcodear Secrets
- modificar Prisma Client generado
- editar migraciones ejecutadas

---

# 22. Checklist Antes del Commit

bash
npm run lint

npm run build

npm test

npm run prisma:validate

npm run sast:rules

npm run sonar:scan

---

# 23. Troubleshooting

## Prisma

bash
npm run prisma:generate

---

## Docker

bash
wsl -e docker compose up -d

---

## Sonar

Verificar:

- SONAR_TOKEN
- SONAR_HOST_URL

---

## JWT inválido

Revisar:

- KeysService
- RSA Keys
- Expiración
- Clock Drift

---

## PostgreSQL

Verificar

bash
docker ps

---

## Render

Recordar:

Los servicios gratuitos entran en sleep.

Los microservicios deben implementar retry.

---

# 24. Estrategia para Asistentes AI

Antes de modificar cualquier código:

1. Leer la documentación relevante.
2. Comprender el flujo completo.
3. Buscar implementaciones similares.
4. Mantener compatibilidad con la arquitectura existente.
5. No romper contratos REST.
6. No duplicar lógica.
7. Mantener tipado estricto.
8. Ejecutar lint.
9. Ejecutar tests.
10. Actualizar documentación si cambia el comportamiento.

Si una tarea afecta autenticación, autorización, políticas, JWT, OPA o Zero Trust, revisar primero docs/seguridad.md y docs/zero-trust-ventas.md.

---

# 25. Objetivo del Proyecto

Este proyecto debe cumplir los requisitos del Proyecto Integrador de Desarrollo de Software Seguro:

- ✅ Zero Trust
- ✅ Shift Left Security
- ✅ JWT
- ✅ JWE/JWS
- ✅ OPA
- ✅ Menús Dinámicos
- ✅ Workspace por Rol
- ✅ PostgreSQL + Prisma
- ✅ DevSecOps
- ✅ SonarQube
- ✅ CodeBERT SAST
- ✅ GitHub Actions
- ✅ Render
- ✅ Clean Architecture
- ✅ Seguridad por defecto

Toda modificación debe preservar estos principios.
