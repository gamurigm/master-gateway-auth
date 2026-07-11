# Seguridad

## Controles implementados

- `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted` y `transform`.
- Helmet activo.
- CORS restringido por `FRONTEND_ORIGIN`.
- Rate limiting global y limites estrictos para `login`, `select-role` y `refresh-token`.
- Passwords con Argon2id.
- JWT con `issuer`, `audience`, expiracion y `jti`.
- Login emite solo `tempToken`; el `accessToken` definitivo se emite despues de seleccionar rol.
- Refresh token persistido como hash y rotado en cada uso.
- Reutilizacion de refresh token marca la familia activa como inactiva.
- CRUD administrativo protegido por JWT y rol `ADMIN`.
- Microservicio hijo `ventas` valida tokens contra el Master antes de responder.
- Endpoint interno protegido por API key y allowlist `INTERNAL_ALLOWED_SERVICES`.
- Logs estructurados con `x-request-id`, estado HTTP, duracion y contexto de usuario/rol cuando existe.
- Eventos de autenticacion registrados sin passwords ni tokens.
- Soft delete con `estado = INACTIVO`.
- Validacion de variables de entorno al arranque.
- Analisis SAST/ML con CodeBERT dockerizado (codebert-sast) para el pipeline.
- En produccion se rechazan secretos con valores `change-me-*`.

## Riesgos pendientes

- `npm audit --omit=dev` reporta `multer@2.1.1` por `@nestjs/platform-express@11.1.27`.
  Nest `latest` y `next` aun fijan esa version; `npm audit fix --force` propone downgrade a Nest 7, por eso no se aplico.
- El frontend guarda tokens en `localStorage`. Para endurecer contra XSS, se recomienda migrar a cookies `HttpOnly` + CSRF.
- Falta autorizacion granular por permiso/menu; actualmente el CRUD administrativo se limita por rol `ADMIN`.
- Falta blacklist temporal de `jti` de access tokens para invalidacion inmediata.
- Falta ampliar el microservicio hijo con permisos granulares por menu/accion; por ahora autoriza roles `ADMIN` y `VENTAS`.

