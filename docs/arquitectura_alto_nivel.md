# Arquitectura de Alto Nivel: Master Gateway

Vista de cómo interactúan las piezas del proyecto: la SPA, el Master de
autenticación/autorización, la base de datos, los microservicios hijos Zero
Trust y el plano DevSecOps (CI/CD).

## Diagrama de componentes

```mermaid
flowchart TD
    classDef frontend fill:#42b883,stroke:#333,stroke-width:2px,color:#fff
    classDef backend fill:#e0234e,stroke:#333,stroke-width:2px,color:#fff
    classDef database fill:#336791,stroke:#333,stroke-width:2px,color:#fff
    classDef microservice fill:#00875a,stroke:#333,stroke-width:2px,color:#fff
    classDef devsecops fill:#5c6bc0,stroke:#333,stroke-width:2px,color:#fff
    classDef user fill:#f9a826,stroke:#333,stroke-width:2px,color:#000

    User(["👤 Usuario / Navegador"]):::user

    subgraph SPA["Frontend — Vue 3 SPA (nginx)"]
        Login["Login"]:::frontend
        RoleSel["Selector de Rol (Workspace)"]:::frontend
        Shell["Shell + Sidebar<br/>rutas inyectadas en runtime"]:::frontend
    end

    subgraph Master["Master Gateway — NestJS + Prisma"]
        Auth["Auth<br/>🔐 tempToken RS256 + accessToken JWE"]:::backend
        Menus["Menús<br/>🌳 árbol en memoria (sin N+1)"]:::backend
        ExtSvc["Servicios externos<br/>🔌 probe anti-SSRF + provisión"]:::backend
        Internal["Endpoint interno<br/>🛡️ valida tokens (Zero Trust)"]:::backend
    end

    subgraph Data["Capa de datos"]
        DB[("PostgreSQL<br/>💾 usuarios, roles, módulos,<br/>menús, servicios_externos,<br/>refresh_tokens, auditoría")]:::database
    end

    subgraph Children["Microservicios hijos (negocio)"]
        Ventas["Ventas<br/>📦 sin base de usuarios"]:::microservice
        Otros["Servicios registrados<br/>dinámicamente"]:::microservice
    end

    subgraph DevSecOps["Plano DevSecOps — GitHub Actions"]
        Sonar["SonarQube<br/>Quality Gate"]:::devsecops
        CodeBERT["CodeBERT SAST<br/>CWE + OWASP 2025"]:::devsecops
        Render["Render<br/>deploy por CLI"]:::devsecops
        TG["Telegram<br/>notificaciones"]:::devsecops
    end

    User -->|1. Credenciales| Login
    Login -->|POST /auth/login| Auth
    Auth -.->|tempToken + roles| RoleSel
    RoleSel -->|2. POST /auth/select-role| Auth
    Auth -.->|accessToken JWE| Shell
    Shell -->|3. GET /menus/tree| Menus
    Menus -.->|árbol JSON → router.addRoute| Shell
    Shell -->|CRUD + probe/provision| ExtSvc

    Auth <--> DB
    Menus <--> DB
    ExtSvc <--> DB
    Internal <--> DB

    Shell -->|4. petición de negocio + token| Ventas
    Ventas -.->|5. valida token| Internal
    ExtSvc -.->|probe /health| Otros
    Otros -.->|valida token| Internal

    Sonar --> CodeBERT --> Render
    Sonar -.-> TG
    CodeBERT -.-> TG
    Render -.-> TG
    Render -.->|despliega| Master
```

### Flujo resumido

1. **Autenticación en dos pasos.** Login valida credenciales (argon2id) y emite
   un `tempToken` de corta vida.
2. **Aislamiento de sesión.** El usuario elige rol en el selector; el sistema
   emite un `accessToken` **JWE cifrado** con *sólo* los permisos de ese rol
   (menor privilegio).
3. **Frontend dinámico.** Con el token, la SPA pide el árbol de menús y construye
   las rutas en tiempo de ejecución (`router.addRoute`) — sin rutas hardcodeadas.
4. **Zero Trust.** Los microservicios hijos no confían en el frontend: validan
   cada token contra el endpoint interno del Master (API key + allowlist).
5. **Extensibilidad.** Nuevos servicios se registran desde la UI: se prueba su
   `/health` (con defensa anti-SSRF) antes de generarles módulo y menús.
6. **DevSecOps.** Cada cambio pasa por build, Quality Gate de SonarQube y SAST
   CodeBERT (con mapeo CWE/OWASP 2025) antes de desplegar por CLI, con Telegram
   notificando cada hito.

## Modelo de datos (entidad-relación)

Todas las entidades comparten el patrón de auditoría (`id` UUID v4, `estado`,
`fecha_creacion`, `fecha_actualizacion`, `creado_por`, `actualizado_por`) y usan
soft delete. Los menús son una lista de adyacencia (`parent_id` a sí misma).

```mermaid
erDiagram
    usuarios ||--o{ usuario_roles : tiene
    roles ||--o{ usuario_roles : agrupa
    roles ||--o{ rol_modulos : accede
    modulos ||--o{ rol_modulos : asignado
    roles ||--o{ rol_menus : ve
    menus ||--o{ rol_menus : asignado
    modulos ||--o{ menus : contiene
    menus ||--o{ menus : parent_id
    modulos ||--o| servicios_externos : generado_por
    usuarios ||--o{ refresh_tokens : posee
    roles ||--o{ refresh_tokens : contexto

    usuarios {
        uuid id PK
        string email UK
        string password_hash "argon2id"
        enum estado
    }
    roles {
        uuid id PK
        string nombre UK
        enum estado
    }
    usuario_roles {
        uuid id PK
        uuid usuario_id FK
        uuid rol_id FK
    }
    modulos {
        uuid id PK
        string codigo UK
        string nombre
    }
    rol_modulos {
        uuid id PK
        uuid rol_id FK
        uuid modulo_id FK
    }
    menus {
        uuid id PK
        string nombre
        string url "solo en hojas"
        uuid modulo_id FK
        uuid parent_id FK "adjacency list"
    }
    rol_menus {
        uuid id PK
        uuid rol_id FK
        uuid menu_id FK
    }
    servicios_externos {
        uuid id PK
        string codigo UK
        string base_url
        string health_path
        uuid modulo_id FK
    }
    refresh_tokens {
        uuid id PK
        uuid usuario_id FK
        string jti UK
        boolean reutilizacion_detectada
    }
```

Los diagramas de secuencia de cada flujo están en
[`docs/diagramas-secuencia.md`](./diagramas-secuencia.md).
