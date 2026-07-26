# Arquitectura Actual del Proyecto: Master Gateway

Diagramas Mermaid detallados de la arquitectura actual al 2026-07-25. Incluye el Patrón Ambassador / InternalProxy recién implementado.

---

## 1. Arquitectura de Alto Nivel (Todo el Stack)

```mermaid
flowchart TD
    classDef user fill:#f9a825,stroke:#333,stroke-width:2px,color:#000
    classDef client fill:#1976d2,stroke:#333,stroke-width:2px,color:#fff
    classDef gw fill:#6a1b9a,stroke:#333,stroke-width:2px,color:#fff
    classDef kong fill:#006064,stroke:#333,stroke-width:2px,color:#fff
    classDef backend fill:#c62828,stroke:#333,stroke-width:2px,color:#fff
    classDef db fill:#2e7d32,stroke:#333,stroke-width:2px,color:#fff
    classDef micro fill:#ef6c00,stroke:#333,stroke-width:2px,color:#fff
    classDef policy fill:#4527a0,stroke:#333,stroke-width:2px,color:#fff
    classDef observ fill:#37474f,stroke:#333,stroke-width:2px,color:#fff
    classDef sec fill:#b71c1c,stroke:#fff,stroke-width:2px,color:#fff

    User(["👤 Usuario / Navegador"]):::user

    subgraph "Capa Cliente (HTTP :4200/:4201)"
        Vue["Vue 3 + Vite + Pinia\n(SPA Dinámica)"]:::client
        Angular["Angular (Legacy)\n(Solo referencia)"]:::client
    end

    subgraph "API Gateway :8000 (Kong 3.8 + Konga UI :1337)"
        Kong["Kong API Gateway\nRate Limit · Auth · Routing"]:::kong
    end

    subgraph "Master Gateway NestJS :3000 (Núcleo Central)"
        Auth["🔐 AuthModule\nLogin 2-pasos\nRefresh rotation\nInternals/validate-token"]:::backend
        Users["👥 UsersModule\n(Soft delete)"]:::backend
        Roles["🛡️ RolesModule\n(Asignaciones)"]:::backend
        Mods["📦 ModulesModule\n(baseUrl + serviceName NUEVOS)"]:::backend
        Menus["🌳 MenusModule\n(Árbol recursivo)"]:::backend
        Perms["🔑 PermissionsModule\n(Catálogo Código)"]:::backend
        Tickets["📨 TicketsModule\n(SSE Server-Sent Events)"]:::backend
        Proxy["🔀 InternalProxyModule ⭐ NUEVO\nPatrón Ambassador / GW Proxy"]:::gw
        Policy["⚖️ PolicyModule\n(OPA Integration)"]:::policy
    end

    subgraph "Base de Datos PostgreSQL 16 :5432"
        Pg[(PostgreSQL 16\n💾 8 modelos)]:::db
    end

    subgraph "Motor de Políticas OPA :8181"
        OPA["OPA Rego Engine\nauthz.rego allow()"]:::policy
    end

    subgraph "Microservicios Child (Zero Trust) — 2 Patrones coexisten"
        V["📈 Ventas :3006\n(PATRÓN 1: validate-token vía HTTP)"]:::micro
        I["📦 Inventario :3007\n(PATRÓN 1: validate-token vía HTTP)"]:::micro
        R["📊 Reportes :3008\n(Soporta AMBOS patrones)"]:::micro
        X["🤖 Cualquier micro INMODIFICABLE\nPython · Java · SaaS · Legacy\n(PATRÓN 2: Ambassador 0 cambios) ⭐"]:::sec
    end

    subgraph "SAST & Observabilidad (Perfil Security)"
        Sonar["SonarQube Community :9000\nQuality Gate"]:::observ
        CodeBERT["CodeBERT ML-SAST\n(PrimeVul + BigVul 0.999)"]:::sec
    end

    User -->|HTTPS| Vue
    Vue -->|/api/* Bearer JWE| Kong
    Kong -->|Reverse Proxy| Auth
    Kong --> Proxy
    Kong --> Users
    Kong --> Roles
    Kong --> Mods
    Kong --> Menus
    Kong --> Perms
    Kong --> Tickets

    Auth <-->|Prisma| Pg
    Users <-->|Prisma| Pg
    Roles <-->|Prisma| Pg
    Mods <-->|Prisma| Pg
    Menus <-->|Prisma| Pg
    Perms <-->|Prisma| Pg
    Tickets <-->|Prisma| Pg

    Policy -->|POST /v1/data| OPA
    Auth -->|Evalúa permisos| Policy

    %% PATRÓN 1: Original (cada micro llama a validate-token)
    V -->|POST internals/validate-token\nx-internal-api-key| Auth
    I -->|POST internals/validate-token\nx-internal-api-key| Auth
    R -.->|Patrón 1 opcional| Auth

    %% PATRÓN 2: Ambassador NUEVO (proxy a través de Gateway)
    Proxy -->|baseUrl desde SystemModule\nSSRF Guard · Headers seguros| V
    Proxy -->|baseUrl desde SystemModule\nSSRF Guard · Headers seguros| I
    Proxy -->|baseUrl desde SystemModule\nSSRF Guard · Headers seguros| R
    Proxy -->|Generic proxy\nCERO cambios en micro| X

    Sonar -.->|Escanea CI CD| backend
    CodeBERT -.->|Reports: codebert-sast.json| backend
```

---

## 2. InternalProxyModule — Patrón Ambassador Detallado (⭐ NUEVO)

```mermaid
sequenceDiagram
    actor U as 👤 Usuario
    participant FE as Vue 3 SPA :4200
    participant K as Kong :8000
    participant GW as InternalProxyModule :3000
    participant DB as PostgreSQL
    participant SSRF as SSRF Guard<br/>(anti DNS rebinding)
    participant POL as OPA Policy (opcional)
    participant MIC as 🤖 Micro Child INMODIFICABLE<br/>(cualquier tecnología)

    U->>FE: Clic en "Reportes → Ventas Resumen"
    FE->>K: GET /api/proxy/REPORTES/ventas-resumen?fecha=2026
    Note over FE,K: Authorization: Bearer <JWE-A256GCM>

    K->>GW: GET /api/proxy/REPORTES/ventas-resumen
    activate GW

    GW->>GW: 1. JwtAuthGuard.resolveAccessToken()<br/>Valida firma + sesión + revocación
    GW->>DB: 2. SELECT * FROM modulos WHERE codigo='REPORTES' AND estado='ACTIVO'
    DB-->>GW: { baseUrl: "http://reportes:3008", serviceName: "reportes", id }

    alt módulo NO registrado o sin baseUrl
        GW-->>FE: 404 Modulo no encontrado / 502 No configurado
    end

    GW->>DB: 3. SELECT 1 FROM rol_modulos WHERE roleId=? AND moduleId=? AND estado='ACTIVO'
    DB-->>GW: ✅ Permiso a nivel módulo

    alt Usuario NO tiene RoleModule para ese módulo
        GW-->>FE: 403 No tiene acceso a este modulo
    end

    GW->>SSRF: 4. assertUrlSafe(baseUrl + path)
    activate SSRF
    SSRF->SSRF: DNS lookup + cache 60s (TOCTOU)
    SSRF->SSRF: Bloquea 18 rangos:<br/>127.x · 10.x · 192.168.x · 172.16.x<br/>::1 · fc00:: · fe80:: · etc
    SSRF-->>GW: ✅ URL segura
    deactivate SSRF

    GW->>MIC: 5. GET http://reportes:3008/ventas-resumen?fecha=2026
    Note over GW,MIC: Cabeceras INYECTADAS por Gateway:<br/>✅ x-user-id: <uuid><br/>✅ x-role-id: <uuid><br/>✅ x-role-name: ADMIN<br/>✅ x-session-id: <sid><br/>✅ x-internal-api-key: <internal_key><br/>✅ x-internal-service: reportes<br/><br/>Cabeceras STRIPEADAS por Gateway:<br/>❌ Authorization<br/>❌ Cookie<br/>❌ Host · Connection · Accept-Encoding<br/>❌ x-internal-* del usuario
    activate MIC

    Note over MIC: NUNCA ve JWT ni API keys.<br/>Solo lee x-user-id y x-role-*.<br/>CERO código de auth en este micro.
    MIC-->>GW: 200 OK + JSON
    deactivate MIC

    GW-->>FE: 200 (o status original del micro) + headers limpios
    deactivate GW

    FE->>U: Renderiza resumen de ventas
```

---

## 3. Flujo de Autenticación Completo (Login 2-pasos)

```mermaid
sequenceDiagram
    actor U as 👤 Usuario
    participant FE as Vue 3 SPA
    participant Jwt as JwtAuthGuard
    participant Auth as AuthService
    participant GS as GatewaySessionService
    participant DB as PostgreSQL (RefreshToken)
    participant Arg as Argon2id

    U->>FE: email + contraseña
    FE->>Auth: POST /api/auth/login { email, pass }
    activate Auth

    Auth->>DB: SELECT user + user_roles WHERE email=?
    DB-->>Auth: Usuario encontrado

    Auth->>Arg: argon2.verify(passwordHash, password)
    Arg-->>Auth: ✅ Coincide

    Auth->>Auth: Firma TempToken (5m, JWT)
    Auth-->>FE: { tempToken, roles[] }
    deactivate Auth

    FE->>U: Muestra selector de roles
    U->>FE: Selecciona rol "ADMIN"

    FE->>Auth: POST /api/auth/select-role { tempToken, roleId }
    activate Auth

    Auth->>DB: Verifica UserRole activo
    Auth->>Auth: issueSessionTokens()
    Note over Auth: accessToken JWE A256GCM 15m<br/>refreshToken JWE A256GCM 7d (con jti rotation)

    Auth->>DB: INSERT INTO refresh_tokens (jti,hash,expira,userId,roleId)
    Auth-->>FE: { accessToken, refreshToken, tokenType, expiresIn }
    deactivate Auth

    Note over FE,DB: --- Cualquier request subsecuente ---
    FE->>Jwt: GET /api/proxy/REPORTES/x<br/>Authorization: Bearer accessToken
    activate Jwt

    Jwt->>GS: resolveAccessToken(accessToken)
    activate GS
    GS->>GS: decryptGatewayToken (JWE A256GCM)
    GS->>DB: SELECT refresh_tokens WHERE jti=sid + user + role
    DB-->>GS: Sesión activa? revokedAt? reemplazado?
    GS-->>Jwt: ✅ AuthenticatedUser { sub,roleId,roleName,sid }
    deactivate GS
    Jwt-->>FE: Continúa a InternalProxy o Controller
    deactivate Jwt
```

---

## 4. Modelo de Datos Actualizado (con baseUrl + serviceName)

```mermaid
erDiagram
    User ||--o{ UserRole : "tiene asignado"
    Role ||--o{ UserRole : "asignado a"
    Role ||--o{ RoleModule : "puede acceder"
    SystemModule ||--o{ RoleModule : "perteneciente a"
    SystemModule ||--o{ Menu : "contiene"
    Menu ||--o{ RoleMenu : "visible para"
    Role ||--o{ RoleMenu : "ve menu"
    Permission ||--o{ RolePermission : "otorgado a"
    Role ||--o{ RolePermission : "tiene permiso"
    User ||--o{ RefreshToken : "propietario"
    Role ||--o{ RefreshToken : "contexto de rol"

    User {
        String id PK "UUID v4"
        String email UK
        String passwordHash "Argon2id"
        String firstName
        String lastName
        Estado estado "ACTIVO/INACTIVO"
    }

    Role {
        String id PK "UUID v4"
        String name UK "SUPERADMIN, ADMIN..."
        String description
        Estado estado
    }

    UserRole {
        String id PK
        String userId FK
        String roleId FK
        Estado estado
    }

    SystemModule {
        String id PK "UUID v4"
        String code UK "EJ: REPORTES, VENTAS"
        String name
        String description
        String baseUrl "⭐ NUEVO: http://localhost:3008"
        String serviceName "⭐ NUEVO: reportes"
        Estado estado
    }

    RoleModule {
        String id PK
        String roleId FK
        String moduleId FK
        Estado estado
    }

    Menu {
        String id PK
        String name
        String url
        String icon
        Int order
        String moduleId FK
        String parentId FK "Adjacency List"
        Estado estado
    }

    RoleMenu {
        String id PK
        String roleId FK
        String menuId FK
        Estado estado
    }

    Permission {
        String id PK
        String code UK "EJ: modules:read"
        String resource "modules,users..."
        String action "read,create,update..."
        Boolean delegable
        Estado estado
    }

    RolePermission {
        String id PK
        String roleId FK
        String permissionId FK
        Estado estado
    }

    RefreshToken {
        String id PK
        String userId FK
        String roleId FK
        String jti UK
        String tokenHash "Argon2id del RT"
        DateTime expiresAt
        DateTime revokedAt "O NULL si activo"
        String replacedByJti "Rotation familia"
        Boolean reuseDetected
    }

    Estado {
        ACTIVO ACTIVO
        INACTIVO INACTIVO
    }
```

---

## 5. Comparativa de los 2 Patrones de Integración (Zero Trust)

```mermaid
flowchart LR
    classDef p1 fill:#ef6c00,stroke:#333,color:#fff
    classDef p2 fill:#283593,stroke:#fff,color:#fff
    classDef pro fill:#2e7d32,stroke:#333,color:#fff
    classDef con fill:#c62828,stroke:#333,color:#fff

    subgraph PATRON_1 ["🧱 Patrón 1: Biblioteca en cada micro (Actual / Legacy)"]
        direction TB
        P1["validate-token() +\nINTERNAL_API_KEY\nDENTRO del micro"]:::p1
        P1_PRO1["✅ Directo: 1 salto GW↔micro\n✅ Netflix · Stripe usan mix\n✅ Ventas/Inventario ya lo usan"]:::pro
        P1_CON1["❌ Cada micro toca tokens + keys\n❌ No soporta micros inmodificables\n❌ Logs dispersos en N sitios\n❌ Python? Java? Binario cerrado? NO"]:::con
    end

    subgraph PATRON_2 ["🚀 Patrón 2: Ambassador / GW Proxy (⭐ NUEVO)"]
        direction TB
        P2["InternalProxyModule\nCERO cambios en micro"]:::p2
        P2_PRO1["✅ Micros CÉGOS de auth (menor superficie)\n✅ Soporta CUALQUIER tecnología\n✅ Logs CENTRALIZADOS en Gateway\n✅ AWS ALB · Kong · Istio = ESTE patrón\n✅ Solo registrar en SystemModule"]:::pro
        P2_CON1["⚠ 2 saltos user→GW→micro→GW→user\n⚠ Latencia ~5-15ms extra por request"]:::con
    end

    PATRON_1 -->|Coexisten| PATRON_2
    PATRON_2 -->|Coexisten| PATRON_1
```

---

## 6. Flujo de Refresh Token Rotation + Reuse Detection

```mermaid
sequenceDiagram
    participant FE as Vue 3 SPA
    participant Auth as AuthService.refresh()
    participant DB as PostgreSQL

    FE->>Auth: refreshToken (jti A)
    activate Auth

    Auth->>DB: SELECT refresh_tokens WHERE jti='A'
    DB-->>Auth: { userId, hash, expiresAt, revokedAt:NULL, replacedBy:NULL }

    alt revokedAt != NULL OR replacedBy != NULL
        Note over Auth,DB: ⚠ REUSE DETECTADO
        Auth->>DB: UPDATE TODOS refresh_tokens WHERE user=? AND role=?\nSET revokedAt=NOW(), reuseDetected=TRUE, estado=INACTIVO
        Auth-->>FE: 401 Refresh token reutilizado (familia invalidada)
    else
        Auth->>Auth: issueSessionTokens() -> newRT jti='B'
        Auth->>DB: INSERT refresh_tokens (jti='B')
        Auth->>DB: UPDATE jti='A' SET revokedAt=NOW(), replacedByJti='B', estado=INACTIVO
        Auth-->>FE: new accessToken + new refreshToken (B)
    end
    deactivate Auth
```
