# Guía: Auto-Registration en Kong y DNS de Docker

## 🎉 ¡No más configuración manual!

Con este sistema, los servicios se registran automáticamente en Kong cuando se levantan los contenedores. No hay necesidad de usar Konga o curl manualmente.

---

## 📦 Arquitectura del Sistema de Auto-Registration

```
┌───────────────────────────────────────────────────────────────────────┐
│                         Docker Compose Stack                           │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────┐   ┌──────────┐   ┌─────────────────────────┐          │
│  │ Kong-DB  │──▶│   Kong   │◀──│   register-backend     │          │
│  └──────────┘   └──────────┘   └─────────────────────────┘          │
│         ▲              ▲                     │                        │
│         │              │                     │ registra               │
│         │              │                     │                        │
│  ┌──────────┐         │              ┌──────────────────┐            │
│  │ Postgres │         │              │   Backend       │            │
│  │ (Master) │         │              │  (Master Gateway)│            │
│  └──────────┘         │              └──────────────────┘            │
│                        │                                             │
│  ┌─────────────────────────┐      ┌──────────────────┐            │
│  │   register-ventas       │◀─────│   Ventas         │            │
│  └─────────────────────────┘      └──────────────────┘            │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 🔍 ¿Cómo funciona el DNS de Docker? ¡La magia detrás de todo!

**Docker tiene su propio sistema DNS interno**, esto es lo que nos evita preocuparnos por IPs fijas:

### 1. Nombres de Host = Nombres de Servicio
Cada servicio en `docker-compose.yml` tiene un **nombre de host** que coincide exactamente con el nombre del servicio:
- `backend` → Hostname: `backend`
- `ventas` → Hostname: `ventas`
- `kong` → Hostname: `kong`
- `postgres` → Hostname: `postgres`

### 2. Resolución de Nombres Automática
Cualquier contenedor en la misma red Docker puede resolver estos nombres a las IPs internas de Docker automáticamente:

```javascript
// Dentro del contenedor "register-backend":
http://backend:3000   // ✅ Funciona! Docker resuelve "backend" a su IP interna
http://kong:8001       // ✅ Funciona! Docker resuelve "kong" a su IP interna
```

### 3. Ventajas Clave
- **No hay IPs fijas**: Docker asigna IPs dinámicamente, no importa si cambian
- **Escalabilidad**: Puedes tener múltiples réplicas de un servicio, Docker hace load balancing
- **Simplicidad**: Solo usas nombres legibles (`backend`, `ventas`) en lugar de números IP
- **Isolación**: Los nombres solo resuelven dentro de la misma red Docker (seguridad)

---

## 🚀 Cómo Usar el Sistema de Auto-Registration

### Paso 1: Levantar toda la infraestructura
```bash
# En WSL2 Ubuntu:
docker-compose up -d
```

Esto hace lo siguiente, en orden:
1. Levanta BDs (`postgres`, `kong-db`)
2. Ejecuta migraciones de Kong
3. Levanta Kong y Konga
4. Levanta `backend` y `ventas`
5. **Ejecuta automáticamente `register-backend` y `register-ventas`** para registrar los servicios en Kong!

### Paso 2: Verificar que funcione
Revisa los logs de los contenedores de auto-registro:
```bash
# Ver logs del registro del backend
docker logs master-gateway-register-backend

# Ver logs del registro de ventas
docker logs master-gateway-register-ventas
```

Deberías ver algo como:
```
🚀 Iniciando Auto-Registration para Kong...
📋 Configuración:
  - Kong Admin: http://kong:8001
  - Nombre de Servicio: master-gateway
  - URL del Servicio: http://backend:3000
  - Rutas: /api

⏳ Esperando 15 segundos para que los servicios estén listos...
🔍 Verificando si el servicio "master-gateway" en Kong...
📝 Creando servicio "master-gateway"...
✅ Servicio "master-gateway" creado correctamente
🔍 Verificando rutas para "master-gateway"...
📝 Creando ruta para "/api"...
✅ Ruta "/api" creada correctamente

🎉 Auto-Registration completado exitosamente!
```

### Paso 3: Probar que las rutas funcionen via Kong
```bash
# Probar Master Gateway via Kong
curl http://localhost:8000/api/health

# Probar Ventas via Kong
curl http://localhost:8000/health
```

---

## 🛠️ Detalles Técnicos del Script de Auto-Registration

### Archivo: `scripts/auto-register-kong.js`
El script es genérico y funciona para cualquier servicio, solo hay que configurar variables de entorno.

### Variables de Entorno Requeridas
| Variable              | Descripción                                       | Ejemplo                          |
|-----------------------|---------------------------------------------------|----------------------------------|
| `KONG_ADMIN_URL`      | URL de la Admin API de Kong                       | `http://kong:8001`               |
| `KONG_SERVICE_NAME`   | Nombre del servicio en Kong                       | `master-gateway`                 |
| `KONG_SERVICE_URL`    | URL interna del servicio (usando DNS de Docker!)  | `http://backend:3000`            |
| `KONG_ROUTE_PATHS`    | Rutas (paths) que Kong usará para redirigir       | `/api` o `/ventas,/health`       |
| `KONG_WAIT_TIME`      | Segundos a esperar antes de registrar (opcional)  | `15`                             |

### Funcionalidades del Script
1. **Espera**: Espera el tiempo configurado para que Kong y el servicio estén listos
2. **Valida**: Verifica que la configuración sea correcta
3. **Registra o Actualiza**:
   - Si el servicio no existe en Kong → lo crea
   - Si ya existe → lo actualiza
4. **Rutas**: Crea las rutas especificadas (si no existen ya)
5. **Idempotente**: Se puede ejecutar múltiples veces sin problemas

---

## 📝 Cómo Agregar un Nuevo Servicio con Auto-Registration

¡Es muy fácil! Sigue estos pasos:

1. **Agrega tu servicio a `docker-compose.yml`**
2. **Agrega un contenedor de auto-registro** como `register-backend` o `register-ventas`
3. **Configura las variables de entorno** con los datos de tu servicio
4. **¡Listo!** Cuando ejecutes `docker-compose up -d`, se registrará automáticamente

Ejemplo genérico:
```yaml
  tu-nuevo-servicio:
    # ... tu configuración del servicio ...

  register-tu-nuevo-servicio:
    image: node:24.15.0-bookworm-slim
    container_name: master-gateway-register-tu-servicio
    depends_on:
      kong:
        condition: service_healthy
      tu-nuevo-servicio:
        condition: service_healthy
    volumes:
      - ./scripts:/scripts
    working_dir: /scripts
    environment:
      KONG_ADMIN_URL: http://kong:8001
      KONG_SERVICE_NAME: tu-servicio
      KONG_SERVICE_URL: http://tu-nuevo-servicio:PUERTO
      KONG_ROUTE_PATHS: /tu-ruta
      KONG_WAIT_TIME: 15
    command: ["node", "auto-register-kong.js"]
    restart: "no"
```

---

## 🔧 Solución de Problemas

### El contenedor de auto-registro falla
- **Verifica que Kong esté listo**: Asegúrate de que el servicio `kong` esté healthy
- **Verifica que tu servicio esté listo**: Asegúrate que tu servicio esté healthy antes de registrar
- **Revisa los logs**: `docker logs master-gateway-register-tu-servicio`

### El servicio no se registra
- Asegúrate de que las variables de entorno estén correctas
- Verifica que `KONG_SERVICE_URL` use el nombre del servicio como host (ej: `http://backend:3000`)
- Revisa los logs para ver errores de conexión

### Las rutas no funcionan
- Asegúrate de que `strip_path` esté en `false` (el script ya lo hace)
- Verifica que Kong esté corriendo: `docker ps | grep kong`
- Prueba la ruta via Kong: `curl http://localhost:8000/api/health`

---

## 📋 Resumen de la Solución Completa

| Component               | Descripción                                                                 |
|-------------------------|-----------------------------------------------------------------------------|
| `docker-compose.yml`    | Toda la infraestructura (servicios, BD, Kong, Konga, auto-registros)       |
| `scripts/auto-register-kong.js` | Script genérico de auto-registro en Kong                    |
| `register-backend`      | Contenedor init que registra Master Gateway                                |
| `register-ventas`       | Contenedor init que registra Microservicio Ventas                          |
| `docs/AUTO_REGISTRATION_GUIDE.md` | Esta guía!                                                    |

---

## 🎊 ¡Felicidades!

Ahora tienes un sistema completamente automático:
- ✅ Zero configuración manual de Kong
- ✅ Auto-registro de servicios al levantar los contenedores
- ✅ DNS de Docker que se encarga de las IPs
- ✅ Idempotente (se puede ejecutar múltiples veces)
- ✅ Guías completas para entender y mantener todo
