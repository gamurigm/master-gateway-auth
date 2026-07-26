# Checklist de Arquitectura y Desarrollo de Software (DevSecOps & Fullstack)

Este documento contiene la lista de comprobación completa para el desarrollo, auditoría, seguridad y despliegue del sistema.

---

## 1. Arquitectura

### Backend
- [ ] **Arquitectura de microservicio Master**: Definición clara de la estructura del microservicio principal.
- [ ] **API REST**: Diseño e implementación siguiendo principios RESTful.
- [ ] **Stateless**: Aplicación sin estado en el servidor; cada petición contiene toda la información necesaria.
- [ ] **JWT**: Autenticación y transmisión segura de información mediante JSON Web Tokens.
- [ ] **Refresh Token**: Mecanismo de renovación de tokens de acceso expiados.
- [ ] **ORM**: Implementación de Object-Relational Mapping (ej. Prisma, TypeORM, Sequelize, SQLAlchemy).
- [ ] **PostgreSQL / MySQL**: Base de datos relacional elegida e implementada.
- [ ] **Variables de entorno**: Configuración centralizada y segura mediante archivos `.env`.
- [ ] **Swagger / OpenAPI**: Documentación interactiva de la API generada automáticamente.

### Frontend
- [ ] **SPA (React / Vue / Angular)**: Aplicación de página única configurada.
- [ ] **Login**: Pantalla y flujo de inicio de sesión.
- [ ] **Selector de Workspace (Rol)**: Interfaz para seleccionar el rol/espacio de trabajo activo.
- [ ] **Dashboard**: Panel principal adaptado al rol del usuario.
- [ ] **Menú dinámico**: Renderizado de menús según permisos devueltos por la API.
- [ ] **Rutas dinámicas**: Generación de rutas en el cliente según permisos/módulos.
- [ ] **Protección de rutas**: Guards / HOCs para impedir acceso no autorizado en el cliente.
- [ ] **Manejo de expiración de JWT**: Interceptores HTTP para refrescar token o redirigir a login.

---

## 2. Modelo de Datos

### Usuarios
- [ ] **CRUD**: Operaciones Crear, Leer, Actualizar y Eliminar (lógico).
- [ ] **Soft Delete**: Marcado de registros inactivos sin borrado físico.
- [ ] **Auditoría**: Registro de trazabilidad en cambios.
- **Campos requeridos**:
  - [ ] `id`
  - [ ] `estado`
  - [ ] `fecha_creacion`
  - [ ] `fecha_actualizacion`
  - [ ] `creado_por`
  - [ ] `actualizado_por`

### Roles
- [ ] **CRUD**: Gestión de roles del sistema.
- [ ] **Soft Delete**: Deshabilitación lógica de roles.
- [ ] **Auditoría**: Campos estándar de trazabilidad.

### Usuario-Rol (Tabla Pivote Many-to-Many)
- [ ] **Tabla pivote**: Relación N:M entre Usuarios y Roles.
- **Campos requeridos**:
  - [ ] `fecha_creacion`
  - [ ] `estado`
  - [ ] `auditoria` (`creado_por`, `actualizado_por`, etc.)

### Módulos
- [ ] **CRUD**: Gestión de módulos del sistema.
- [ ] **Soft Delete**: Eliminación lógica.

### Menús (Estructura Jerárquica)
- [ ] **Tabla única con autoreferencia**:
  - [ ] `id`
  - [ ] `nombre`
  - [ ] `url`
  - [ ] `modulo_id`
  - [ ] `parent_id`
- **Soporte de niveles**:
  - [ ] Nivel 1: Menú
  - [ ] Nivel 2: Submenú
  - [ ] Nivel 3: Item

---

## 3. Autenticación

### Login
- [ ] **Credenciales**: Autenticación vía `Usuario + Contraseña`.
- [ ] **Respuesta inicial**: Devuelve `TempToken` y `Lista de Roles` disponibles para el usuario.

### Selector de Rol
- [ ] **Selección**: Usuario elige el rol activo para la sesión.
- [ ] **Token definitivo**: Se emite el `JWT` definitivo firmado con los claims del rol seleccionado.

### JWT (Estructura Estricta)
- **Contenido obligatorio (claims)**:
  - [ ] `userId`
  - [ ] `roleId`
  - [ ] `permisos del rol` (únicamente los asociados al rol activo)
- **Restricciones**:
  - [ ] **NO contener permisos globales** indebidos.

### Refresh Token & Logout
- [ ] **Refresh Token**: Implementado con almacenamiento seguro.
- [ ] **Logout**: Invalidación explícita de tokens (blacklist o revocación en DB/Redis).

---

## 4. Autorización

- [ ] **Guards / Middlewares**: Capas de protección activadas en los controladores/rutas.
- [ ] **Validación JWT**: Verificación de firma, vigencia y emisor.
- [ ] **Validación por Rol**: Restricción de endpoints según rol del token.
- [ ] **Validación por Permisos**: Verificación granular de permisos por acción/endpoint.
- [ ] **Protección completa**: Todos los endpoints privados adecuadamente resguardados.

---

## 5. Menú Dinámico

- [ ] **Backend**: Algoritmo recursivo para construir la estructura jerárquica (árbol) del menú según permisos.
- [ ] **Frontend**: Renderizado recursivo del menú a partir del JSON entregado por el backend.
- [ ] **Prohibido**: Rutas o menús hardcodeados en el código del frontend.

---

## 6. Endpoints

### Auth
- [ ] `POST /login`
- [ ] `POST /select-role`
- [ ] `POST /refresh-token`
- [ ] `POST /logout`

### Internos
- [ ] `POST /validate-token`

### Usuarios
- [ ] `GET /usuarios` (Listar)
- [ ] `GET /usuarios/{id}` (Detalle)
- [ ] `POST /usuarios` (Crear)
- [ ] `PUT /usuarios/{id}` (Actualizar)
- [ ] `DELETE /usuarios/{id}` (Soft Delete)

### Roles
- [ ] `GET /roles`
- [ ] `POST /roles`
- [ ] `PUT /roles/{id}`
- [ ] `DELETE /roles/{id}`
- [ ] `POST /roles/asignar-usuario`
- [ ] `POST /roles/desasignar-usuario`

### Módulos
- [ ] `GET /modulos`
- [ ] `POST /modulos`
- [ ] `PUT /modulos/{id}`
- [ ] `DELETE /modulos/{id}`
- [ ] `POST /modulos/asignar-modulo`

### Menús
- [ ] `GET /menus/arbol` (Obtener árbol jerárquico)
- [ ] `POST /menus`
- [ ] `PUT /menus/{id}`
- [ ] `DELETE /menus/{id}`
- [ ] `POST /menus/asignar-rol`

---

## 7. Seguridad (Shift Left)

### Passwords
- [ ] Uso de algoritmos fuertemente seguros: **Argon2** o **bcrypt** con alto factor de costo.

### Prevención de SQL Injection
- [ ] Uso estricto de **ORM** y **Consultas Parametrizadas**.
- [ ] **Prohibido**: SQL concatenado manualmente.

### Validaciones e Inputs
- [ ] **DTOs**: Definición clara de esquemas de entrada.
- [ ] **Sanitización**: Limpieza de entradas contra XSS / Injection.
- [ ] **Validación de entradas**: Reglas estrictas en controladores (ej. `class-validator`, `Joi`, `Zod`).

### Manejo de Secrets
- [ ] Configuración exclusiva vía archivos `.env` o Gestor de Secretos.
- [ ] **Prohibido**: Claves JWT o contraseñas hardcodeadas en repositorio.

### Zero Trust Architecture
- [ ] Todos los endpoints requieren token JWT explícito (salvo login público).
- [ ] Validación continua en cada solicitud.
- [ ] Microservicios validan tokens de manera independiente o vía API Gateway.

### Least Privilege (Mínimo Privilegio)
- [ ] El JWT contiene únicamente los permisos mínimos necesarios para el rol seleccionado.

---

## 8. Performance

- [ ] **Consultas Recursivas**: Uso de `WITH RECURSIVE` / CTEs en BD para construir el árbol de menús.
- [ ] **Optimización ORM**: Prevención explícita de problemas N+1 (uso de `eager loading` / `joins`).

---

## 9. Auditoría

- [ ] Todas las tablas del modelo incluyen los campos:
  - `estado`
  - `fecha_creacion`
  - `fecha_actualizacion`
  - `creado_por`
  - `actualizado_por`

---

## 10. Soft Delete

- [ ] **Prohibido**: Comandos `DELETE` físicos en tablas de negocio.
- [ ] **Estándar**: Actualización de campo `estado = 'INACTIVO'` o equivalente.

---

## 11. CI/CD

- [ ] **GitHub Actions**: Workflows configurados para integración y despliegue continuo.
- **Etapas del Pipeline**:
  - [ ] Build
  - [ ] Unit Test
  - [ ] SonarCloud
  - [ ] SAST
  - [ ] Deploy

---

## 12. SonarCloud

- [ ] Proyecto configurado en SonarCloud.
- [ ] Token de autenticación vinculado en secretos del repositorio.
- [ ] **Quality Gate**: Verificación activa que bloquea el pipeline si falla.

---

## 13. SAST (Static Application Security Testing)

- [ ] **Modelo / Herramienta**: Implementado mediante CodeBERT, script de Python dedicado o contenedor Docker.
- [ ] **Retorno de ejecución**:
  - `exit 0`: Sin vulnerabilidades críticas.
  - `exit 1`: Vulnerabilidad detectada (detiene el pipeline).

---

## 14. Git Strategy

- [ ] **Ramas principales configuradas**:
  - `main`
  - `test`
  - `dev`
- [ ] **Estrategia de ramas de características**:
  - `feature/*`

---

## 15. Deploy

- [ ] Plataforma de alojamiento: **Railway** o **Render**.
- [ ] Despliegue automatizado activado desde GitHub Actions tras superar el pipeline.

---

## 16. Telegram Bot (Notificaciones)

- [ ] Notificación de **Inicio de Pipeline**.
- [ ] Notificación de **Sonar OK**.
- [ ] Notificación de **Sonar FAIL**.
- [ ] Notificación de **ML / SAST detectó vulnerabilidad**.
- [ ] Notificación de **Deploy OK**.
- [ ] Notificación de **Deploy FAIL**.
- [ ] Notificación de **Merge a `dev`**.
- [ ] Notificación de **Merge a `test`**.

---

## 17. Documentación

- [ ] **README**: Guía clara de presentación del proyecto.
- [ ] **Arquitectura**: Diagrama y explicación de componentes.
- [ ] **Modelo ER**: Diagrama Entidad-Relación actualizado.
- [ ] **Swagger**: Documentación de la API accesible online.
- [ ] **Variables de entorno**: Archivo `.env.example` de referencia.
- [ ] **Instalación**: Guía paso a paso para entorno local.
- [ ] **CI/CD**: Documentación del workflow de integración continua.
- [ ] **Sonar**: Explicación de métricas y Quality Gate.
- [ ] **Deploy**: Explicación del flujo de despliegue.

---

## 18. Extra (Excelencia / Calificación Máxima)

- [ ] **Dockerfile**: Configurado y optimizado (multi-stage build).
- [ ] **docker-compose**: Configuración local para servicios (BD, Backend, Frontend).
- [ ] **Tests unitarios**: Pruebas de componentes y lógica de negocio.
- [ ] **Tests de integración**: Pruebas de endpoints y flujo de datos.
- [ ] **Cobertura de código**: > 80%.
- [ ] **Logging estructurado**: Registro formateado en JSON / Winston / Pino.
- [ ] **Manejo global de errores**: Interceptor / Filter para respuestas de error estandarizadas.
- [ ] **Rate Limiting**: Protección contra ataques de fuerza bruta / DoS.
- [ ] **CORS configurado**: Dominios permitidos explícitamente restringidos.
- [ ] **Helmet**: Encabezados HTTP de seguridad configurados (Express/NestJS).
- [ ] **CSP**: Content Security Policy definida.
- [ ] **CSRF**: Protección contra Cross-Site Request Forgery (si aplica).
- [ ] **Validación de JWT expirado**: Manejo claro y seguro en el cliente y servidor.
- [ ] **Rotación de Refresh Tokens**: Revocación y emisión de nuevo refresh token en uso.
- [ ] **Índices en la base de datos**: Optimización en claves foráneas y campos de búsqueda frecuente.
- [ ] **Migraciones del ORM**: Control de versiones de la estructura de base de datos.
- [ ] **Seed de datos**: Script de carga de datos iniciales.
- [ ] **Roles iniciales**: Datos sembrados para roles predefinidos (ej. ADMIN, USER).
- [ ] **Usuario administrador inicial**: Creación automatizada del superadministrador inicial.

---

## 🎯 Rúbrica de Cumplimiento

| Área | Peso Aproximado | Estado |
| :--- | :---: | :---: |
| **Arquitectura** | 10% | ☐ |
| **Modelo de datos** | 10% | ☐ |
| **CRUDs** | 15% | ☐ |
| **Autenticación** | 15% | ☐ |
| **Autorización** | 10% | ☐ |
| **Menú dinámico** | 10% | ☐ |
| **Seguridad (Shift-Left)** | 15% | ☐ |
| **Zero Trust** | 5% | ☐ |
| **CI/CD + Sonar + SAST** | 5% | ☐ |
| **Deploy + DevSecOps** | 5% | ☐ |

---
*Documento generado para seguimiento de entregables del proyecto.*
