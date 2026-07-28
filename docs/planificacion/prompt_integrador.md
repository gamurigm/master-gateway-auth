
Prompt Refinado: Plataforma de Integración centrada en el flujo Módulo → Menú → Item → Microservicio
Contexto del Proyecto
El Master Gateway actual (backend/) ya implementa:
Componente Archivo/Ubicación
Service Registry ExternalService model en prisma/schema.prisma:89
Service Proxy ServiceProxyService en service-proxy/service-proxy.service.ts
Proxy Routes ExternalServiceRoute model en prisma/schema.prisma:130
SSRF Guard assertSafeProbeTarget en external-services/ssrf-guard.ts
OPA Policy PolicyGuard + PolicyService en common/policy/
Menús dinámicos MenusService.treeForRole() en menus/menus.service.ts
Rutas dinámicas frontend dynamic-routes.ts en frontend-vue
DynamicPageView DynamicPageView.vue que consume /api/proxy/*
JWE/JWS jwe-token.ts con RSA-OAEP-256 + A256GCM
Zero Trust validate POST /api/internals/validate-token
Registro de servicios ExternalServicesService con probe, provision, metadata discovery
Principio de prueba fundamental
La forma principal de probar que todo funciona es:
Crear Módulo → Crear Menú (con URL destino del micro)
→ Asignar a Rol → Click en el menú del sidebar
→ DynamicPageView llama a /api/proxy/...
→ ServiceProxy resuelve ExternalServiceRoute
→ Redirige al microservicio → Muestra la respuesta JSON
No se necesita abrir localhost:PORT directo. No se necesita curl. El navegador es la herramienta de validación.
Mapeo de conceptos abstractos a implementación concreta
Concepto abstracto Implementación en el proyecto
Service Registry Prisma ExternalService + ExternalServiceRoute
Service Discovery POST /api/external-services/probe + metadata endpoint
Smart Proxy ServiceProxyService.forward() + resolveRoute() + SSRF Guard
Plugin Architecture ExternalService.code único + resolución dinámica en proxy
Strategy Pattern ServiceProxyService sin lógica específica por servicio
Zero Trust JwtAuthGuard + RolesGuard + PolicyGuard + proxy con headers de identidad
Contrato mínimo GET /health + GET /internal/metadata
Flujo de prueba Módulo → Menú → Item (con targetUrl) → Proxy → Micro
El flujo Módulo → Menú → Item como eje de la arquitectura
Cómo funciona actualmente
Admin en UI
  → Módulos: crea "Inventario" (código: inventario)
  → Menús: crea raíz "Inventario" (sin URL)
  → Menús: crea hijo "Productos" (URL: /app/inventario/productos)
  → Menús: en el mismo formulario, completa "URL destino" (<http://inventario:3007/inventario/productos>)

Backend recibe el POST /menus con targetUrl
  → Si targetUrl está presente:
    1. Crea ExternalService oculto (code: route<uuid></uuid>, baseUrl extraída del targetUrl)
    2. Crea Menu
    3. Crea ExternalServiceRoute (publicPath, targetPath, methods)
  → Todo en una transacción

Usuario click en "Productos"
  → DynamicPageView llama GET /api/proxy/inventario/productos
  → ServiceProxyService.resolveRoute() busca en ExternalServiceRoute
  → Encuentra ruta con publicPath = "/inventario/productos"
  → Valida método HTTP, autorización del usuario
  → Construye target: <http://inventario:3007/inventario/productos>
  → Valida SSRF, agrega headers de identidad, reenvía
  → Devuelve respuesta al DynamicPageView
Cómo se prueba un nuevo microservicio

1. Correr el micro (Docker, node local, o donde sea)
2. Verificar health: GET /health → 200
3. Desde la UI: Módulos → Crear módulo (código, nombre)
4. Menús → Crear menú raíz (nombre, módulo)
5. Menús → Crear menú hoja con:
   - URL SPA: /app/<servicio></servicio>/<recurso></recurso>
   - URL destino: http://<host></host>:<port></port>/<ruta></ruta>
   - Métodos: GET, POST, etc.
6. Roles → Asignar el menú al rol
7. Cerrar sesión → Reingresar con ese rol
8. Click en el menú → Ver respuesta JSON del micro
   Validación sin necesidad de pruebas técnicas
   Cada microservicio integrado se valida con esta checklist:

- ¿Aparece en el sidebar al seleccionar el rol?
- ¿El DynamicPageView muestra la respuesta del micro?
- ¿Los errores HTTP se traducen correctamente (401, 403, 404, 500)?
- ¿El menú raíz agrupa correctamente los hijos?
  Ninguna requiere curl, Postman, ni terminal.
  Contrato Mínimo para Servicios Nativos
  Los micros en services/* deben implementar únicamente:
  GET /health
  { "status": "ok", "service": "inventario" }
  GET /internal/metadata (opcional pero recomendado)
  {
  "name": "Inventario",
  "version": "1.0.0",
  "description": "Gestión de inventario",
  "endpoints": [
  { "name": "Productos", "path": "/inventario/productos", "method": "GET" }
  ],
  "permissions": [
  { "code": "inventario:read", "resource": "inventario", "action": "read" }
  ]
  }
  El Gateway NO exige al micro implementar POST /internals/validate-token. Cuando el micro corre a través del proxy, éste inyecta headers de identidad (x-gateway-user-id, x-gateway-role) y el micro confía en esos headers porque vienen del Gateway autenticado como servicio.
  Identity Gap — Lo que falta
  Estado actual del Service Identity:
  Estrategia Estado
  API Key única compartida (MASTER_INTERNAL_API_KEY) ✅ Implementada (para micros que llaman a /internals/validate-token)
  API Key por servicio ❌ Pendiente
  Service JWT ❌ Pendiente
  mTLS ❌ Pendiente (preparar arquitectura)
  JWKS (/.well-known/jwks.json) ❌ Pendiente
  Propuesta inmediata:

1. En ExternalService o ServiceRegistry, agregar columna apiKey (única por servicio)
2. Crear ServiceIdentityService que inyecte la API Key correcta en los headers del proxy
3. Si el micro no tiene API Key configurada → no inyectar (el proxy solo pasa headers de identidad de usuario)
   CI/CD Inteligente — Detección automática de nuevos servicios
   Principio: Si aparece services/facturacion/, el pipeline debe detectarlo sin modificar workflows.
   Estrategia:
4. Workflow principal escanea services/* con git diff o ls
5. Genera matriz dinámica de servicios
6. Ejecuta lint + test + build + docker build para cada servicio detectado
7. Si es nuevo (no existía en main), también corre security scan + sonar

# Pseudocódigo del workflow

jobs:
  detect:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.scan.outputs.matrix }}
    steps:
      - uses: actions/checkout@v4
      - id: scan
        run: |
          services=$(ls -d services/*/dist/server.js 2>/dev/null | sed 's|services/||;s|/dist/server.js||' | jq -R -s -c 'split["\n"](:-1)')
          echo "matrix={\"service\":$services}" >> $GITHUB_OUTPUT

  build:
    needs: detect
    strategy:
      matrix: ${{ fromJson(needs.detect.outputs.matrix) }}
    steps:
      - run: docker build -t ${{ matrix.service }} ./services/${{ matrix.service }}
Arquitectura de prueba completa
Para probar un micro nuevo hipotético services/facturacion/:

1. Crear services/facturacion/dist/server.js con:

   - GET /health → 200
   - GET /facturacion/facturas → lista de facturas
2. Crear services/facturacion/package.json
3. Crear services/facturacion/Dockerfile
4. Agregar al docker-compose.yml (template estándar, solo cambiar puerto)
5. docker compose build facturacion
6. docker compose up -d facturacion
7. En la UI:

   - Módulo: código "facturacion", nombre "Facturación"
   - Menú raíz: "Facturación", icono "file-text", módulo "Facturación"
   - Menú hijo: "Facturas", URL "/app/facturacion/facturas",
     URL destino "<http://facturacion:3009/facturacion/facturas>", GET
8. Asignar a rol ADMIN
9. Click en "Facturas" → ver facturas
10. El CI/CD lo detecta automáticamente porque apareció services/facturacion/
    ADR — Decisiones clave
    ADR-1: El menú con targetUrl crea ExternalService sin intervención del usuario
    Decisión: Al guardar un menú con targetUrl, el backend crea automáticamente un registro oculto en ExternalService (con prefijo route). El usuario no necesita ir al módulo External Services.
    Alternativa rechazada: Forzar al usuario a registrar el servicio en External Services primero y luego crear el menú. Duplica esfuerzo y confunde.
    Consecuencia: Los menús con targetUrl son detectables en BD. Si en el futuro se quiere "promover" un menú a servicio completo, se puede.
    ADR-2: El proxy inyecta headers de identidad, no reenvía el JWT
    Decisión: El service-proxy elimina Authorization del request saliente y agrega x-gateway-user-id, x-gateway-role, etc.
    Razón: El micro destino no necesita saber el JWT. Solo necesita saber quién es el usuario. Esto evita que el micro tenga que validar JWT y reduce el riesgo de fuga de tokens.
    ADR-3: Service Identity es independiente de User Identity
    Decisión: Separar ServiceIdentityService de JwtAuthGuard. El proxy se autentica como servicio usando su propia estrategia (API Key, Service JWT, mTLS) antes de agregar headers de usuario.
    Razón: Zero Trust exige no confiar en la red. El micro destino debe saber que la petición viene del Gateway legítimo, no de un impostor en la misma red Docker.
    ADR-4: No exigir /internals/validate-token a servicios externos
    Decisión: Los micros nativos (en services/) pueden implementar POST /internals/validate-token para validación directa (opción legacy). Los micros nuevos y externos usan el proxy con headers de identidad.
    Razón: Desacoplar. Un micro externo (SAP, Stripe) jamás va a implementar un endpoint custom del Gateway.
    Este prompt describe exactamente cómo la plataforma debe operar y cómo se prueba cada integración usando el flujo Módulo → Menú → Item → Proxy → Micro, tanto para servicios en Docker como para servicios externos corriendo en cualquier entorno.
