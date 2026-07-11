# Arquitectura de Alto Nivel: Master Gateway

A continuación se presenta un diagrama visual de cómo interactúan las distintas piezas del proyecto actualmente, basándose en la arquitectura Zero Trust y la centralización de seguridad.

```mermaid
flowchart TD
    %% Definición de estilos
    classDef frontend fill:#dd2c00,stroke:#333,stroke-width:2px,color:#fff
    classDef backend fill:#e0234e,stroke:#333,stroke-width:2px,color:#fff
    classDef database fill:#336791,stroke:#333,stroke-width:2px,color:#fff
    classDef microservice fill:#00875a,stroke:#333,stroke-width:2px,color:#fff
    classDef user fill:#f9a826,stroke:#333,stroke-width:2px,color:#000

    %% Nodos
    User(["👤 Usuario / Navegador"]):::user

    subgraph "Frontend (Angular SPA)"
        Login["Pantalla Login"]:::frontend
        RoleSelector["Selector de Rol / Workspace"]:::frontend
        Dashboard["Dashboard Dinámico (Rutas Generadas)"]:::frontend
    end

    subgraph "Backend: Master Gateway (NestJS)"
        AuthService["Módulo de Autenticación<br/>🔐 Emite TempToken y JWT Final"]:::backend
        MenuService["Módulo de Menús<br/>🌳 Genera Árbol Recursivo"]:::backend
        ValidationService["Endpoint Interno<br/>🛡️ Valida Tokens (Zero Trust)"]:::backend
    end

    subgraph "Capa de Datos"
        DB[("PostgreSQL<br/>💾 Users, Roles, Menús,<br/>Tokens, Auditoría")]:::database
    end

    subgraph "Microservicios Hijos (Negocio)"
        VentasService["Microservicio: Ventas<br/>📦 (No tiene base de usuarios)"]:::microservice
    end

    %% Relaciones y Flujo
    User -->|1. Ingresa Credenciales| Login
    Login -->|Llama API| AuthService
    AuthService -.->|Retorna TempToken y Roles| RoleSelector

    RoleSelector -->|2. Usuario elige Rol| AuthService
    AuthService -.->|Retorna JWT Definitivo| Dashboard

    Dashboard -->|3. Solicita Navegación| MenuService
    MenuService -.->|Devuelve JSON del Menú| Dashboard

    AuthService <-->|Lee/Escribe estado| DB
    MenuService <-->|Consultas CTE Recursivas| DB
    ValidationService <-->|Verifica sesiones| DB

    Dashboard -->|4. Petición de negocio con JWT| VentasService
    VentasService -.->|5. Delega validación de acceso| ValidationService
```

### Explicación del Flujo:

1. **Autenticación en Dos Pasos**: El usuario ingresa al **Login**, el backend valida sus credenciales y emite un *TempToken* (solo válido para el siguiente paso).
2. **Aislamiento de Sesión**: Obligatoriamente, el usuario pasa al **Selector de Rol**. Una vez elige el rol con el que va a trabajar (ej. Administrador), el sistema le otorga el **JWT Definitivo** que contiene *únicamente* los permisos de ese rol elegido.
3. **Frontend Dinámico**: Con el JWT definitivo, el Angular SPA solicita la estructura de menús. El backend lee la base de datos de manera recursiva y le devuelve un JSON con el menú (Sidebar) que le corresponde, construyendo las rutas en ese instante (no hay rutas _hardcodeadas_).
4. **Zero Trust en Acción**: Cuando el usuario intenta acceder a un recurso de negocio (como el **Microservicio de Ventas**), el SPA envía el JWT. El microservicio de ventas *no confía* en el SPA ni tiene base de datos de usuarios; en su lugar, pregunta inmediatamente al Master Gateway (`ValidationService`) si ese token es válido y si tiene permisos para entrar. Si la respuesta es afirmativa, le entrega los datos al usuario.
