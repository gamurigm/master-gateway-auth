# Configuración de Despliegue en Render

| Servicio | Root Directory | Build Command | Start Command | Publish Directory | Variables |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Frontend** | `.` | `npm ci && npm run build:frontend` | N/A | `frontend/dist/frontend/browser` | No runtime. La URL de API debe quedar embebida en `frontend/src/environments/environment.ts` con la URL pública del Backend |
| **Backend** | `.` | `npm ci --include=dev && npm run build:backend` | `npm run start:backend:prod` | N/A | `DATABASE_URL`, `FRONTEND_ORIGIN`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_PRIVATE_KEY_PATH`, `JWT_PUBLIC_KEY_PATH`, `INTERNAL_API_KEY`, `INTERNAL_ALLOWED_SERVICES`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `NODE_ENV=production` |

## Notas finales

- `render.yaml` actual no sirve tal cual para la estrategia de 2 servicios; hoy está pensado como un solo servicio Docker.
- No uses `yarn install` como Start Command. Ese comando instala dependencias,
  no abre el puerto HTTP y puede fallar cuando `postinstall` intenta ejecutar
  Prisma sin las dependencias de desarrollo.
- Si despliegas frontend y backend separados, el backend debe exponer `FRONTEND_ORIGIN` con la URL final del sitio Angular.
- Si más adelante agregas ventas a Render, ese tercer servicio necesitaría: `MASTER_VALIDATE_URL`, `MASTER_INTERNAL_API_KEY`, `MASTER_INTERNAL_SERVICE_NAME`, `VENTAS_ALLOWED_ROLES`, `MASTER_VALIDATE_RETRY_ATTEMPTS` y `MASTER_VALIDATE_RETRY_DELAY_MS`.
