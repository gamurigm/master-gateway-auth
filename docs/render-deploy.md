# Verificación y despliegue remoto en Render

El backend público configurado para las pruebas es:

```text
https://master-gateway-auth.onrender.com
```

Comprobación rápida, sin usar Docker local:

```bash
curl --fail --show-error https://master-gateway-auth.onrender.com/api/health
curl --fail --show-error https://master-gateway-auth.onrender.com/api/health/db
```

Pruebas funcionales con respuestas legibles:

```bash
API_URL=https://master-gateway-auth.onrender.com/api \
EMAIL=admin@example.com \
PASSWORD='tu-clave-de-render' \
INTERNAL_API_KEY='tu-clave-interna' \
./scripts/test-api.sh
```

El script crea datos de prueba mediante los POST de usuarios, roles, módulos,
menús y asignaciones. Usa `jq` y detiene la ejecución mostrando el mensaje de
error del backend cuando una respuesta no es 2xx.

## Variables obligatorias en Render

`DATABASE_URL`, `FRONTEND_ORIGIN`, `JWE_SECRET`, `JWT_SECRET`,
`TEMP_JWT_SECRET`, `REFRESH_JWT_SECRET`, `INTERNAL_API_KEY`, además de
`JWT_ISSUER=master-gateway`, `JWT_AUDIENCE=master-gateway-clients` e
`INTERNAL_ALLOWED_SERVICES=ventas`.

El workflow y `scripts/configure-render-environment.sh` actualizan estas
variables antes de crear el deploy. Los secretos deben existir en GitHub como
secrets; `FRONTEND_ORIGIN` y `SEED_ADMIN_EMAIL` como variables.

Los IDs se guardan como secrets `RENDER_SERVICE_ID`,
`RENDER_FRONTEND_SERVICE_ID` y `RENDER_DATABASE_ID`. Tras aprobar todos los
gates, el pipeline de `main` configura y despliega el mismo commit en backend y
frontend, y verifica health, contenido Vue y CORS.

Si Render devuelve un estado de despliegue fallido, el job conserva el fallo y
añade al log de GitHub Actions el `errorMessage` del despliegue y hasta 200 logs
recientes del servicio. El binario de Render CLI se valida con el checksum
SHA-256 publicado para la versión utilizada.

El arranque ejecuta `backend/prisma/deploy-migrations.cjs`. Este script solo
recupera el fallo conocido `P3009` de la migración duplicada
`20260728051029_add_service_api_key`: la marca como revertida y vuelve a ejecutar
`prisma migrate deploy`. Cualquier otra migración fallida detiene el despliegue.

## Saneamiento único de datos demo

El seed es idempotente y elimina los menús legacy con UUID `000...`; todos los
IDs demo fijos son UUID v4. Para una limpieza total controlada, configura
`SEED_RESET=true` temporalmente en Render, ejecuta un deploy, verifica el health
y retira inmediatamente esa variable. No debe quedar activa en despliegues
normales porque elimina los datos de la base.
