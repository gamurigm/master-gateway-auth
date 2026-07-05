# ADR 0001 - Stack inicial

## Decision

El proyecto se implementa como monorepo con:

- Backend: NestJS, Prisma y PostgreSQL.
- Frontend: Angular, Angular CLI y Angular Router.
- Seguridad: JWT, Argon2, validacion DTO y guards por endpoint.

## Motivo

El stack permite cubrir autenticacion, autorizacion por rol, menu recursivo, Zero Trust y CI/CD con una separacion clara entre API y SPA.
