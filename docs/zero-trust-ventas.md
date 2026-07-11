# Microservicio hijo: Ventas

El servicio `ventas` demuestra el enfoque Zero Trust del proyecto:

- No tiene tabla local de usuarios.
- No confia en el frontend.
- Requiere `Authorization: Bearer <accessToken>`.
- Valida el token llamando al Master Gateway en `POST /api/internals/validate-token`.
- Protege la llamada interna con `x-internal-api-key`.
- Identifica al hijo con `x-internal-service` y el Master aplica allowlist.
- Aplica retry cuando el Master no responde temporalmente.

## Ejecutar localmente

Primero levanta el Master Gateway:

```bash
npm run dev:backend
```

Luego levanta ventas:

```bash
npm run dev:ventas
```

Variables relevantes:

| Variable | Valor por defecto |
| --- | --- |
| `VENTAS_PORT` | `3006` |
| `MASTER_VALIDATE_URL` | `http://localhost:3000/api/internals/validate-token` |
| `MASTER_INTERNAL_API_KEY` | `change-me-internal-key` |
| `MASTER_INTERNAL_SERVICE_NAME` | `ventas` |
| `INTERNAL_API_KEY` | Fallback compatible si no se define `MASTER_INTERNAL_API_KEY` |
| `VENTAS_ALLOWED_ROLES` | `ADMIN,VENTAS` |
| `MASTER_VALIDATE_RETRY_ATTEMPTS` | `3` |
| `MASTER_VALIDATE_RETRY_DELAY_MS` | `500` |

## Probar

1. Ejecuta login en el Master.
2. Ejecuta select-role con el rol `ADMIN`.
3. Usa el `accessToken` contra ventas:

```bash
curl -H "Authorization: Bearer <accessToken>" http://localhost:3006/ventas/ordenes
```

Respuestas esperadas:

| Caso | Respuesta |
| --- | --- |
| Sin token | `401 Token requerido` |
| Token invalido o expirado | `401 Token invalido o expirado` |
| Rol no autorizado | `403 Rol no autorizado para ventas` |
| Master caido | `503 Master Gateway no disponible` |
| Rol autorizado | `200` con ordenes demo |
