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
- Analisis SAST/ML con CodeBERT dockerizado (codebert-sast) para el pipeline, con mapeo CWE + OWASP Top 10 : 2025.
- En produccion se rechazan secretos con valores `change-me-*`.
- Secretos de `docker-compose.yml` inyectados desde `.env` (`${VAR:?}`), no versionados.
- Defensa SSRF en el probe de servicios externos (ver abajo).

## Defensa SSRF del registro de servicios externos

El endpoint `POST /external-services/probe` hace peticiones salientes a una URL que controla el
usuario administrador, lo que es un vector clasico de **SSRF (CWE-918 / OWASP 2025 A01)**: sin
controles, permitiria usar el Master como proxy hacia la red interna o hacia el servicio de
metadatos de la nube (`169.254.169.254`, que suele exponer credenciales de la instancia).

Mitigaciones aplicadas (`backend/src/external-services/ssrf-guard.ts`):

- Solo se admiten los esquemas `http` y `https`.
- Se rechazan URLs con credenciales embebidas (`http://user:pass@host`).
- La validacion se hace sobre la **IP resuelta**, no sobre el hostname: un dominio publico que
  resuelva a `127.0.0.1` tambien se bloquea.
- Se bloquean loopback, rangos privados (RFC 1918), CGNAT y link-local, cubriendo tanto IPv4 como
  IPv6 y las direcciones IPv4 mapeadas en IPv6 (`::ffff:127.0.0.1`, en sus formas decimal y hex).
- `redirect: 'manual'`: un 302 hacia un destino restringido saltaria la validacion de la URL
  original.
- Timeout de 5 s, cuerpo de respuesta acotado y throttle propio de 10 req/min en el endpoint.
- La variable `ALLOW_PRIVATE_PROBE_TARGETS=true` habilita rangos privados, necesaria en
  docker-compose y Kubernetes (los hijos viven en direcciones privadas). Debe quedar en `false`
  en produccion.

## Riesgos pendientes

- `npm audit --omit=dev` reporta `multer@2.1.1` por `@nestjs/platform-express@11.1.27`.
  Nest `latest` y `next` aun fijan esa version; `npm audit fix --force` propone downgrade a Nest 7, por eso no se aplico.
- El frontend guarda tokens en `localStorage`. Para endurecer contra XSS, se recomienda migrar a cookies `HttpOnly` + CSRF.
- Falta autorizacion granular por permiso/menu; actualmente el CRUD administrativo se limita por rol `ADMIN`.
- Falta blacklist temporal de `jti` de access tokens para invalidacion inmediata.
- Falta ampliar el microservicio hijo con permisos granulares por menu/accion; por ahora autoriza roles `ADMIN` y `VENTAS`.

