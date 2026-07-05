# Master Gateway - Autenticacion y Autorizacion Centralizada

Microservicio maestro full-stack que centraliza autenticacion, autorizacion basada en roles y construccion dinamica de menus para un ecosistema de microservicios con enfoque Zero Trust.

## Stack

| Capa     | Tecnologia                                               |
| -------- | -------------------------------------------------------- |
| Backend  | NestJS + TypeScript                                      |
| ORM      | Prisma                                                   |
| BD       | PostgreSQL 16                                            |
| Frontend | Angular + Angular CLI + Angular Router *(en desarrollo)* |
| Seguridad| JWT, Argon2, Guards, DTO Validation, Helmet              |
| Infra    | Docker Compose, GitHub Actions                           |

## Comenzar

```bash
# 1. Clonar e instalar
npm install

# 2. Copiar variables de entorno
cp .env.example .env

# 3. Levantar base de datos
docker compose up -d

# 4. Migration y seed
npm run prisma:migrate
npm run prisma:seed

# 5. Iniciar backend
npm run dev:backend
```

## Estructura

```
backend/
├── prisma/          # Schema, migraciones y seed
├── src/
│   ├── auth/        # Login, select-role, refresh, logout
│   ├── users/       # CRUD de usuarios
│   ├── roles/       # CRUD de roles y asignacion
│   ├── modules/     # CRUD de modulos
│   ├── menus/       # CRUD de menus y arbol recursivo
│   ├── common/      # Guards, decorators, DTOs, auditoria
│   └── prisma/      # Servicio Prisma
└── test/            # Pruebas e2e
```

## Funcionalidades clave

- Login con `tempToken` + seleccion obligatoria de rol antes del dashboard
- JWT final con un solo rol activo (`accessToken` + `refreshToken`)
- Rotacion y deteccion de reuso en refresh tokens
- CRUD completo de usuarios, roles, modulos y menus con soft delete
- Arbol de navegacion recursivo (`GET /api/menus/tree`) segun rol
- Endpoint interno `POST /api/internals/validate-token` para Zero Trust
- Auditoria en todas las entidades (`creado_por`, `actualizado_por`)
- Endpoints protegidos con Guards, validacion DTO y rate limiting

## Endpoints principales

### Autenticacion
| Metodo | Ruta                    | Descripcion                  |
| ------ | ----------------------- | ---------------------------- |
| POST   | `/api/auth/login`       | Inicio de sesion             |
| POST   | `/api/auth/select-role` | Seleccion de rol de trabajo  |
| POST   | `/api/auth/refresh-token`| Rotar refresh token         |
| POST   | `/api/auth/logout`      | Cerrar sesion                |
| POST   | `/api/internals/validate-token` | Validacion interna Zero Trust |

### Gestion
| Metodo | Ruta                     | Descripcion             |
| ------ | ------------------------ | ----------------------- |
| GET    | `/api/users`             | Listar usuarios         |
| POST   | `/api/users`             | Crear usuario           |
| GET    | `/api/roles`             | Listar roles            |
| POST   | `/api/roles`             | Crear rol               |
| GET    | `/api/modules`           | Listar modulos          |
| POST   | `/api/modules`           | Crear modulo            |
| GET    | `/api/menus/tree`        | Arbol de menus por rol  |
| POST   | `/api/menus`             | Crear menu              |

## Seed

```bash
npm run prisma:seed
```

Crea: admin, rol admin, modulo Administracion y menus iniciales.

## Pruebas

```bash
npm test
npm run test:e2e
```

## Documentacion

- `docs/adr/` - Registro de decisiones tecnicas
- `PLAN_IMPLEMENTACION_MASTER_GATEWAY.md` - Plan detallado de implementacion

## Licencia

UNLICENSED - Proyecto academico ESPE.
