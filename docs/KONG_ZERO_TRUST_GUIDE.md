# Guía de Implementación: Kong API Gateway + Zero Trust

## Arquitectura General

```
                    ┌─────────────────┐
                    │   Frontend      │
                    │  (Angular)      │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Kong API       │
                    │  Gateway        │
                    │  (puerto 8000)  │
                    └───────┬─────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
    ┌──────────────────┐          ┌──────────────────┐
    │  Master Gateway  │          │  Microservicio    │
    │  (NestJS :3000)  │          │  Ventas (:3006)   │
    └────────┬─────────┘          └────────┬─────────┘
             │                             │
             └─────────────────────────────┘
                     │
                     ▼
            ┌──────────────────┐
            │  PostgreSQL      │
            │  (Master+Kong)   │
            └──────────────────┘
```

## Requisitos Previos

- Docker y Docker Compose instalados en WSL2 (Ubuntu)
- Node.js 24+ para ejecutar el proyecto
- El proyecto "Master Gateway" clonado localmente

---

## Paso 1: Verificar la Configuración de Zero Trust (Servicio Ventas)

El servicio de ventas **ya implementa** la lógica de validación delegada:

1. Extrae el JWT del header `Authorization`
2. Llama al endpoint `POST /api/internals/validate-token` del Master Gateway
3. Envía la cabecera de seguridad `x-internal-api-key`
4. Valida la respuesta y decide si permitir o rechazar la petición

Código relevante en `services/ventas/src/server.ts`:
- `extractBearerToken()`: Extrae el token del header
- `validateTokenWithMaster()`: Valida el token con el Master Gateway
- `handleOrders()`: Aplica la lógica de autorización

Variables de entorno en `.env` para Ventas:
- `MASTER_VALIDATE_URL`: URL del Master Gateway para validación
- `MASTER_INTERNAL_API_KEY`: API Key interna para comunicación segura
- `VENTAS_ALLOWED_ROLES`: Roles autorizados para acceder a Ventas

---

## Paso 2: Levantar la Infraestructura Completa con Docker Compose

Abre una terminal en WSL2 (Ubuntu) y navega al directorio del proyecto:

```bash
# En Windows PowerShell, accede a WSL:
wsl
cd /mnt/c/Users/gamur/Documents/ESPE\ VII\ SI\ 2026/Desarrollo\ Seguro/U3/p/
```

Ejecuta Docker Compose para levantar todos los servicios:

```bash
# Si es la primera vez, build las imágenes primero:
docker-compose build

# Levantar todos los servicios (incluyendo Kong y Konga):
docker-compose up -d
```

Esto levantará:
- PostgreSQL (Master Gateway y Kong)
- Master Gateway (NestJS :3000)
- Frontend (Angular :4200)
- Microservicio Ventas (:3006)
- Kong API Gateway (:8000 proxy, :8001 admin)
- Konga UI (:1337)
- SonarQube (para análisis de seguridad)

Espera 2-3 minutos para que todos los servicios estén listos.

---

## Paso 3: Configurar Kong API Gateway

### Opción A: Script de Configuración Automática (Recomendado)

Ejecuta el script `setup-kong.sh` para configurar Kong automáticamente:

```bash
# Dar permisos de ejecución al script:
chmod +x scripts/setup-kong.sh

# Ejecutar el script:
./scripts/setup-kong.sh
```

### Opción B: Configuración Manual via Konga UI

Si prefieres usar la interfaz gráfica de Konga:

1. **Abre Konga UI**: Abre tu navegador y visita `http://localhost:1337`
2. **Crea una cuenta**: Registra un usuario/admin la primera vez
3. **Conecta Konga a Kong**:
   - Haz clic en "CONNECTION"
   - Nombre de la conexión: `Local Kong`
   - Kong Admin URL: `http://kong:8001` (o `http://localhost:8001`)
   - Haz clic en "CREATE CONNECTION"
   - Selecciona la conexión para acceder al dashboard

4. **Crea el Service para Master Gateway**:
   - Ve a "SERVICES" > "ADD NEW SERVICE"
   - Name: `master-gateway`
   - URL: `http://backend:3000`
   - Haz clic en "SUBMIT"

5. **Crea Routes para Master Gateway**:
   - Dentro del service `master-gateway`, ve a "ROUTES" > "ADD ROUTE"
   - Name: `master-api`
   - Paths: `/api`
   - Strip Path: Desactivado
   - Haz clic en "SUBMIT"

6. **Crea el Service para Ventas**:
   - Ve a "SERVICES" > "ADD NEW SERVICE"
   - Name: `ventas-service`
   - URL: `http://ventas:3006`
   - Haz clic en "SUBMIT"

7. **Crea Routes para Ventas**:
   - Dentro del service `ventas-service`, ve a "ROUTES" > "ADD ROUTE"
   - Name: `ventas-api`
   - Paths: `/ventas`, `/health`
   - Strip Path: Desactivado
   - Haz clic en "SUBMIT"

---

## Paso 4: Verificar la Configuración

### 4.1 Verificar Servicios y Rutas en Kong

```bash
# Verificar servicios
curl http://localhost:8001/services

# Verificar rutas
curl http://localhost:8001/routes
```

### 4.2 Probar la Infraestructura

1. **Probar Health Check del Master Gateway via Kong**:
   ```bash
   curl http://localhost:8000/api/health
   ```

2. **Probar Health Check de Ventas via Kong**:
   ```bash
   curl http://localhost:8000/health
   ```

3. **Probar el flujo completo (requiere autenticación)**:
   - Abre el frontend en `http://localhost:4200`
   - Inicia sesión con credenciales de admin (`admin@example.com` / `Admin12345!`)
   - Selecciona un rol
   - Usa el menú para navegar
   - Para probar Ventas, necesitarás un JWT válido y hacer una petición a `http://localhost:8000/ventas/ordenes` con el token en el header `Authorization`

---

## Paso 5: Prueba de la Seguridad Zero Trust

### Prueba 1: Petición sin Token (debe fallar)

```bash
curl -i http://localhost:8000/ventas/ordenes
```

Resultado esperado: `401 Unauthorized` - Token requerido.

### Prueba 2: Petición con Token Inválido (debe fallar)

```bash
curl -i -H "Authorization: Bearer token-invalido-12345" http://localhost:8000/ventas/ordenes
```

Resultado esperado: `401 Unauthorized` - Token inválido o expirado.

### Prueba 3: Petición con Token Válido (debe funcionar)

1. Primero, obtén un token válido via login:
   ```bash
   curl -i -X POST http://localhost:8000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "admin@example.com", "password": "Admin12345!"}'
   ```

2. Luego, usa el `tempToken` para seleccionar un rol:
   ```bash
   curl -i -X POST http://localhost:8000/api/auth/select-role \
     -H "Content-Type: application/json" \
     -d '{"tempToken": "TU_TEMP_TOKEN", "roleId": "ID_DEL_ROL_ADMIN"}'
   ```

3. Finalmente, usa el `accessToken` para acceder a Ventas:
   ```bash
   curl -i -H "Authorization: Bearer TU_ACCESS_TOKEN" http://localhost:8000/ventas/ordenes
   ```

Resultado esperado: `200 OK` con la lista de órdenes.

---

## Resumen de Puertos

| Servicio               | Puerto | Descripción                  |
|------------------------|--------|------------------------------|
| Kong Proxy             | 8000   | API Gateway (público)        |
| Kong Proxy HTTPS       | 8443   | API Gateway HTTPS            |
| Kong Admin API         | 8001   | Admin API de Kong            |
| Konga UI               | 1337   | Interfaz gráfica de Kong     |
| Master Gateway         | 3000   | Backend NestJS (interno)     |
| Frontend               | 4200   | Angular SPA                  |
| Ventas                 | 3006   | Microservicio (interno)      |
| PostgreSQL Master      | 5442   | BD del Master Gateway        |
| PostgreSQL Kong        | 5443   | BD de Kong                   |
| SonarQube              | 9000   | Análisis de seguridad        |

---

## Solución de Problemas

### Kong no está listo
Espera un par de minutos y revisa los logs:
```bash
docker-compose logs kong
```

### No puede conectarse a backend o ventas
Asegúrate de que los servicios estén en la misma red Docker y los nombres de host sean correctos (`backend` y `ventas`).

### El script setup-kong.sh no funciona
Ejecuta los comandos curl manualmente, copiándolos del script.

---

## Archivos Relevantes

- `docker-compose.yml`: Configuración de toda la infraestructura
- `scripts/setup-kong.sh`: Script de configuración automática de Kong
- `services/ventas/src/server.ts`: Lógica de validación Zero Trust del microservicio Ventas
- `backend/src/auth/auth.service.ts`: Lógica de validación de tokens en el Master Gateway
- `docs/KONG_ZERO_TRUST_GUIDE.md`: Esta guía!
