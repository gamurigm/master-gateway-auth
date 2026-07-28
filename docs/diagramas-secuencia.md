
# Diagramas de secuencia

Los diagramas §8 del enunciado, más el flujo de registro de microservicios
externos. Reflejan la **implementación real**, no la figura idealizada: donde el
proyecto se desvía del PDF (token JWE en vez de JWT firmado, árbol de menús
armado en memoria en vez de CTE), se indica explícitamente.

## 1. Autenticación y selección de rol

Login en dos fases: credenciales → `tempToken` (RS256, 5 min) → selección de rol
→ token de acceso. El token de acceso es un **JWE cifrado (`dir` + `A256GCM`)**,
más fuerte que el JWT firmado que pedía el PDF: el contenido va cifrado, no sólo
firmado.

```mermaid
sequenceDiagram
    actor U as Usuario
    participant F as Frontend (Vue SPA)
    participant M as Master (NestJS)
    participant DB as PostgreSQL

    U->>F: Ingresa email y contraseña
    F->>M: POST /api/auth/login
    M->>DB: Busca usuario activo
    DB-->>M: Usuario + hash argon2id
    M->>M: argon2.verify(password, hash)
    M-->>F: 200 { tempToken (RS256, 5m), roles[] }
    Note over F: NO se entra al dashboard.<br/>Se fuerza el selector de rol.

    U->>F: Selecciona un rol
    F->>M: POST /api/auth/select-role { tempToken, roleId }
    M->>DB: Verifica que el usuario tenga ese rol
    DB-->>M: Asignación válida
    M->>M: Genera accessToken (JWE dir/A256GCM, 15m)<br/>y refreshToken (RS256, 7d) con rotación
    M->>DB: Persiste refresh token (hash argon2id + jti)
    M-->>F: 200 { accessToken, refreshToken, role }
    Note over F: El token lleva SÓLO los permisos<br/>del rol elegido (menor privilegio).
```

## 2. Carga dinámica del menú recursivo

El frontend pide el árbol tras seleccionar rol y, con él, **inyecta las rutas en
tiempo de ejecución** (`router.addRoute`), sin rutas hardcodeadas.

> Nota de implementación: el enunciado sugería una CTE recursiva
> (`WITH RECURSIVE`). La implementación real hace **una sola consulta plana** de
> los menús del rol y arma el árbol en memoria (`menus.service.ts`). Cumple el
> requisito de rendimiento (sin N+1, una query, portable entre motores) sin
> `WITH RECURSIVE`. Ver `docs/modelo-datos.md`.

```mermaid
sequenceDiagram
    actor U as Usuario
    participant F as Frontend (Vue SPA)
    participant M as Master (NestJS)
    participant DB as PostgreSQL

    F->>M: GET /api/menus/tree<br/>Authorization: Bearer <accessToken JWE>
    M->>M: JwtAuthGuard descifra el JWE,<br/>valida expiración y extrae roleId
    alt Token inválido o expirado
        M-->>F: 401 Unauthorized
    else Token válido
        M->>DB: Menús ACTIVOS del rol (una consulta plana)
        DB-->>M: Filas con parent_id / modulo_id
        M->>M: Arma el árbol en memoria<br/>(módulo → submenú → item[url])
        M-->>F: 200 { árbol de menús }
        F->>F: registerMenuRoutes(): router.addRoute()<br/>por cada hoja /app/* + renderiza el sidebar
    end
```

## 3. Integración Zero Trust con el microservicio hijo (Ventas)

El microservicio de ventas **no confía en el frontend** ni tiene base de usuarios:
valida el token contra el Master en cada petición.

```mermaid
sequenceDiagram
    actor U as Usuario
    participant F as Frontend
    participant V as Ventas (hijo)
    participant M as Master (NestJS)

    U->>F: Clic en el menú "Pedidos" (/ventas/ordenes)
    F->>V: GET /ventas/ordenes<br/>Authorization: Bearer <token del Master>
    Note over V: Zero Trust: Ventas NO confía en el token.
    V->>M: POST /api/internals/validate-token<br/>x-internal-api-key + x-internal-service: ventas
    M->>M: Valida API key interna, allowlist de servicio<br/>y descifra el JWE
    alt Token o servicio no autorizado
        M-->>V: 401 Unauthorized
        V-->>F: 403 Forbidden
    else Autorizado
        M-->>V: 200 { userId, roleId, roleName }
        Note over V: Reintenta si el Master está dormido<br/>(Render se suspende a los 15 min).
        V->>V: Ejecuta su lógica de negocio
        V-->>F: 200 { pedidos }
        F-->>U: Muestra la vista de Ventas
    end
```

## 4. Pipeline CI/CD (DevSecOps)

Flujo del anexo: build → SonarQube gate → SAST CodeBERT (con CWE/OWASP 2025) →
deploy por CLI, con notificaciones a Telegram en cada hito.

```mermaid
sequenceDiagram
    actor Dev as Desarrollador
    participant GH as GitHub Actions
    participant ST as Self-test SAST
    participant SQ as SonarQube
    participant CB as CodeBERT SAST
    participant R as Render
    participant TG as Telegram

    Dev->>GH: push / merge a main
    GH->>TG: 🚀 Pipeline iniciado en main
    GH->>GH: build-test (unit + e2e)
    GH->>ST: selftest.py contra fixtures vulnerables
    ST-->>GH: recall 100%, exit 0
    GH->>SQ: análisis + Quality Gate
    alt Quality Gate != OK
        SQ-->>GH: gate FAIL
        GH->>TG: Quality Gate: FAILED (deploy bloqueado)
    else Quality Gate OK
        SQ-->>GH: gate OK
        GH->>CB: escaneo con modelo CodeBERT + reglas CWE
        alt Hallazgos CRITICAL
            CB-->>GH: status VULNERABLE, exit 1
            GH->>TG: ⚠️ Alerta SAST con CWE, OWASP 2025,<br/>línea, evidencia y CVEs
        else Sin críticos
            CB-->>GH: status SAFE, exit 0
            GH->>R: render deploys create --wait
            R-->>GH: deploy OK
            GH->>TG: ✅ Despliegue terminado
        end
    end
```

## 5. Registro dinámico de un microservicio externo

Alta de un servicio hijo: se prueba que responde **antes** de crearle módulo y
menús, con defensa anti-SSRF en el probe.

```mermaid
sequenceDiagram
    actor A as Admin
    participant F as Frontend (wizard)
    participant M as Master (NestJS)
    participant EXT as Servicio externo
    participant DB as PostgreSQL

    A->>F: Paso 1 — datos + "Probar conexión"
    F->>M: POST /api/external-services/probe { baseUrl, healthPath }
    M->>M: Guarda SSRF: valida esquema y la IP resuelta<br/>(bloquea loopback / privado / 169.254.169.254)
    M->>EXT: GET {baseUrl}{healthPath} (timeout 5s, sin redirects)
    EXT-->>M: 200 OK (+ OpenAPI si expone openApiPath)
    M-->>F: { reachable, latencyMs, discoveredEndpoints[] }
    Note over F: "Guardar" sigue bloqueado si el probe falla.

    A->>F: Paso 2 — elige endpoints→menús y roles
    A->>F: Paso 3 — confirma
    F->>M: POST /api/external-services (re-verifica el probe)
    M->>DB: Registra el servicio (lastProbeOk = true)
    F->>M: POST /api/external-services/:id/provision { roleIds, items }
    M->>DB: Transacción: módulo + menú raíz (sin url)<br/>+ hojas (con url) + rol_modulos + rol_menus
    DB-->>M: OK
    M-->>F: { module, menus }
    F->>M: GET /api/menus/tree (recarga)
    M-->>F: Árbol con el nuevo módulo
    F->>F: router.addRoute() → el menú aparece SIN recargar la página
```
