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
`TEMP_JWT_SECRET`, `REFRESH_JWT_SECRET`, `INTERNAL_API_KEY`, `OPA_URL`, además de
`JWT_ISSUER=master-gateway`, `JWT_AUDIENCE=master-gateway-clients` e
`INTERNAL_ALLOWED_SERVICES=ventas,inventario`.

`OPA_URL` debe apuntar al servicio OPA que expone
`/v1/data/master_gateway/authz/allow`. En local el valor por defecto es
`http://localhost:8181`. Si se usa `render.yaml` como Blueprint, el backend lo
toma del servicio privado `master-gateway-opa`; si se usa el workflow que
configura un servicio existente por API, debe existir `vars.OPA_URL` en GitHub
Actions antes del deploy.

El workflow y `scripts/configure-render-environment.sh` actualizan estas
variables antes de crear el deploy. Los secretos deben existir en GitHub como
secrets; `FRONTEND_ORIGIN` y `SEED_ADMIN_EMAIL` como variables.

## Saneamiento único de datos demo

El seed es idempotente y elimina los menús legacy con UUID `000...`; todos los
IDs demo fijos son UUID v4. Para una limpieza total controlada, configura
`SEED_RESET=true` temporalmente en Render, ejecuta un deploy, verifica el health
y retira inmediatamente esa variable. No debe quedar activa en despliegues
normales porque elimina los datos de la base.
