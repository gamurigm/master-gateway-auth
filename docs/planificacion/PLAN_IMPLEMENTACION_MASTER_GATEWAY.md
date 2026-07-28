# Plan de implementacion - Master Gateway de Autenticacion y Autorizacion

Fuente base:
[`PROY_PARCIAL_III_DesSeguro_202650.pdf`](../requisitos/PROY_PARCIAL_III_DesSeguro_202650.pdf)
revisado completo, incluyendo texto, tablas de endpoints y diagramas de
secuencia.

## 1. Objetivo del proyecto

Construir un microservicio maestro full-stack que centralice:

- Autenticacion de usuarios.
- Seleccion explicita de rol de trabajo despues del login.
- Emision, renovacion, validacion e invalidacion de tokens.
- Gestion de usuarios, roles, modulos y menus recursivos.
- Construccion dinamica de navegacion en frontend.
- Integracion Zero Trust con microservicios hijos.
- Seguridad Shift-Left desde desarrollo, pruebas y pipeline CI/CD.

El resultado esperado es un sistema donde ningun microservicio hijo mantenga su propia base de usuarios y donde el frontend no tenga rutas administrativas hardcodeadas.

## 2. Stack tecnico propuesto

Como el PDF permite varias tecnologias, se recomienda una opcion concreta para ejecutar el proyecto con rapidez y buena seguridad:

- Backend: NestJS + TypeScript.
- ORM: Prisma.
- Base de datos: PostgreSQL.
- Frontend: Angular + Angular CLI + Angular Router.
- Contenedores locales: Docker Compose.
- Tokens: JWT con `accessToken`, `refreshToken` y `tempToken`.
- Hash de passwords: Argon2id, o Bcrypt si Argon2 complica el despliegue.
- Seguridad de API: Guards, Pipes, DTO validation, rate limiting y Helmet.
- CI/CD: GitHub Actions, SonarCloud, analisis SAST/ML, notificaciones Telegram y despliegue por CLI a Railway o Render.

Si el equipo ya eligio otro stack, la equivalencia principal seria:

- NestJS Guards = Spring Security Filters = FastAPI Dependencies = Django Middleware.
- Prisma Schema = TypeORM Entities = JPA Entities = SQLAlchemy Models.
- Angular Router dinamico = Vue Router dinamico = React Router dinamico.

## 3. Decisiones tecnicas clave antes de codificar

1. Ruta oficial para menu dinamico:

   - El diagrama usa `GET /api/menu/structure`.
   - La tabla oficial usa `GET /api/menus/tree`.
   - Decision recomendada: implementar `GET /api/menus/tree` y documentarlo como endpoint canonico.
2. Estrategia JWT:

   - MVP: JWT firmado por el Master y validado en cada endpoint.
   - Recomendado para Zero Trust: RS256 con llave privada en Master y llave publica para microservicios hijos.
   - Mantener tambien `POST /api/internals/validate-token` porque el PDF lo exige.
3. Estado y eliminacion:

   - Todas las entidades deben tener `estado`.
   - No hacer hard delete en usuarios, roles, modulos ni menus.
   - Para tablas pivote, usar auditoria y marcar relaciones como inactivas. Si el docente exige delete fisico en pivote, agregar una tabla de auditoria para no perder trazabilidad.
4. Token despues de seleccionar rol:

   - El JWT final solo debe incluir el rol activo y permisos de ese rol.
   - No incluir todos los roles del usuario.
   - Claims recomendados: `sub`, `roleId`, `roleName`, `jti`, `iss`, `aud`, `iat`, `exp`.
5. Seguridad en frontend:

   - El login no debe enviar al dashboard directamente.
   - Despues del login se muestra el selector de workspace/rol.
   - El menu y rutas se construyen desde el JSON devuelto por backend.

## 4. Modelo de datos base

Todas las tablas deben incluir campos comunes:

- `id`: UUID.
- `estado`: `ACTIVO` o `INACTIVO`.
- `fecha_creacion`: timestamp automatico.
- `fecha_actualizacion`: timestamp automatico.
- `creado_por`: UUID nullable.
- `actualizado_por`: UUID nullable.

Tablas principales:dale )revisa esi tod

- `usuarios`

  - `id`
  - `email`
  - `password_hash`
  - `nombres`
  - `apellidos`
  - campos comunes
- `roles`

  - `id`
  - `nombre`
  - `descripcion`
  - campos comunes
- `usuario_roles`

  - `id`
  - `usuario_id`
  - `rol_id`
  - campos comunes
  - indice unico parcial recomendado: usuario y rol activos no repetidos.
- `modulos`

  - `id`
  - `nombre`
  - `descripcion`
  - `codigo`
  - campos comunes
- `rol_modulos`

  - `id`
  - `rol_id`
  - `modulo_id`
  - campos comunes
- `menus`

  - `id`
  - `nombre`
  - `url`
  - `modulo_id`
  - `parent_id`
  - `orden`
  - `icono`
  - campos comunes
- `rol_menus`

  - `id`
  - `rol_id`
  - `menu_id`
  - campos comunes
- `refresh_tokens`

  - `id`
  - `usuario_id`
  - `rol_id`
  - `jti`
  - `token_hash`
  - `expira_en`
  - `revocado_en`
  - `reemplazado_por_jti`
  - `reutilizacion_detectada`
  - campos comunes

Indices minimos:

- `usuarios.email` unico.
- `usuario_roles(usuario_id, rol_id)`.
- `rol_modulos(rol_id, modulo_id)`.
- `menus(parent_id)`.
- `menus(modulo_id)`.
- `rol_menus(rol_id, menu_id)`.
- `refresh_tokens(jti)`.

## 5. Endpoints minimos a implementar

Autenticacion:

- `POST /api/auth/login`
- `POST /api/auth/select-role`
- `POST /api/auth/refresh-token`
- `POST /api/auth/logout`

Validacion interna:

- `POST /api/internals/validate-token`

Usuarios:

- `GET /api/users`
- `GET /api/users/:id`
- `POST /api/users`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`

Roles:

- `GET /api/roles`
- `POST /api/roles`
- `PUT /api/roles/:id`
- `DELETE /api/roles/:id`
- `POST /api/roles/:id/users`
- `DELETE /api/roles/:id/users/:userId`

Modulos:

- `GET /api/modules`
- `GET /api/modules/:id`
- `POST /api/modules`
- `PUT /api/modules/:id`
- `DELETE /api/modules/:id`
- `POST /api/roles/:id/modules`

Menus:

- `GET /api/menus/tree`
- `POST /api/menus`
- `PUT /api/menus/:id`
- `DELETE /api/menus/:id`
- `POST /api/roles/:id/menus`

## 6. Fases de implementacion

### Fase 0 - Preparacion del proyecto

Objetivo: dejar claro como se trabajara antes de escribir funcionalidades.

Pasos:

1. Crear repositorio Git si aun no existe.
2. Crear ramas base:
   - `main`
   - `test`
   - `dev`
3. Definir convencion de ramas:
   - `feature/auth-login`
   - `feature/users-crud`
   - `feature/menu-tree`
   - `fix/token-refresh`
4. Crear archivo `.env.example` con variables necesarias sin secretos reales.
5. Crear `README.md` inicial con stack, instalacion y comandos.
6. Crear una carpeta `docs/` para arquitectura, diagramas y evidencias.
7. Registrar decisiones tecnicas en `docs/adr/`.
8. Definir Definition of Done:
   - codigo compila
   - pruebas pasan
   - endpoints protegidos
   - sin secrets en codigo
   - validaciones DTO activas
   - soft delete aplicado
   - documentacion actualizada

Criterio de salida:

- El equipo puede clonar el repositorio, instalar dependencias y conocer el flujo de ramas.

### Fase 1 - Scaffolding backend, frontend e infraestructura local

Objetivo: crear la base ejecutable del sistema.

Pasos backend:

1. Crear proyecto NestJS.
2. Instalar dependencias base:
   - Prisma
   - PostgreSQL client
   - class-validator
   - class-transformer
   - passport-jwt
   - argon2 o bcrypt
   - helmet
   - rate limiter
3. Configurar estructura modular:
   - `auth`
   - `users`
   - `roles`
   - `modules`
   - `menus`
   - `common`
   - `internals`
4. Configurar validacion global con pipes.
5. Configurar manejo centralizado de errores.
6. Configurar prefijo global `/api`.
7. Agregar endpoint `GET /api/health`.

Pasos frontend:

1. Crear proyecto Angular con Angular CLI.
2. Configurar rutas base:
   - `/login`
   - `/select-role`
   - `/app`
   - `/unauthorized`
3. Crear cliente HTTP con interceptor para token.
4. Crear estado de autenticacion.
5. Crear layout base con sidebar dinamico vacio.

Pasos infraestructura local:

1. Crear `docker-compose.yml` con PostgreSQL.
2. Agregar volumen persistente local.
3. Crear scripts:
   - `dev`
   - `build`
   - `test`
   - `lint`
   - `prisma:migrate`
   - `prisma:seed`

Criterio de salida:

- Backend responde `/api/health`.
- Frontend abre login.
- PostgreSQL levanta en Docker.
- Proyecto corre localmente con comandos documentados.

### Fase 2 - Modelo de datos, migraciones y seed

Objetivo: implementar el modelo relacional con auditoria y soft delete desde el inicio.

Pasos:

1. Crear modelos Prisma para usuarios, roles, modulos, menus y pivotes.
2. Implementar campos comunes en todos los modelos.
3. Configurar UUID como identificador principal.
4. Agregar relaciones M:N:
   - usuarios a roles
   - roles a modulos
   - roles a menus
5. Agregar relacion recursiva en `menus` con `parent_id`.
6. Crear indices y restricciones unicas.
7. Crear primera migracion.
8. Crear seed minimo:
   - usuario admin
   - rol admin
   - modulo administracion
   - menus iniciales para usuarios, roles, modulos y menus
9. Hashear password del admin, nunca guardarlo plano.
10. Probar rollback y re-ejecucion de seed.

Criterio de salida:

- La base refleja el modelo del PDF.
- Existe usuario admin funcional.
- No hay passwords planos.
- Todas las entidades tienen auditoria y estado.

### Fase 3 - Capa comun de seguridad, auditoria y soft delete

Objetivo: evitar que cada endpoint repita logica de seguridad y filtros.

Pasos:

1. Crear enum de estado: `ACTIVO`, `INACTIVO`.
2. Crear helpers o middleware Prisma para:
   - asignar `fecha_creacion`
   - asignar `fecha_actualizacion`
   - aplicar filtros por `estado = ACTIVO`
3. Crear servicio comun de auditoria para `creado_por` y `actualizado_por`.
4. Crear decorador para obtener usuario autenticado.
5. Crear guard JWT base.
6. Crear guard de rol activo.
7. Crear politica para impedir que controladores modifiquen campos gestionados por ORM.
8. Agregar tests unitarios para soft delete y auditoria.

Criterio de salida:

- Los endpoints no devuelven registros inactivos por accidente.
- La auditoria se completa automaticamente.
- Los controladores no reciben ni aceptan campos internos manipulables.

### Fase 4 - CRUD de usuarios y roles

Objetivo: implementar gestion de identidad.

Pasos usuarios:

1. Crear DTOs:
   - `CreateUserDto`
   - `UpdateUserDto`
   - `UserResponseDto`
2. Validar email, password y campos requeridos.
3. Hashear password al crear usuario.
4. Excluir `password_hash` en toda respuesta.
5. Implementar paginacion en `GET /api/users`.
6. Filtrar siempre por usuarios activos.
7. Implementar update sin permitir cambiar auditoria manualmente.
8. Implementar delete logico cambiando `estado`.

Pasos roles:

1. Crear DTOs de rol.
2. Implementar CRUD de roles.
3. Prevenir eliminacion de rol si esta asignado a usuarios activos.
4. Implementar asignacion de usuario a rol.
5. Implementar desasignacion de usuario a rol con auditoria.
6. Evitar duplicados usuario-rol activos.

Pruebas:

1. Crear usuario valido.
2. Rechazar password debil.
3. Rechazar email duplicado.
4. Confirmar que no se serializa `password_hash`.
5. Confirmar soft delete.
6. Confirmar bloqueo de eliminacion de rol en uso.

Criterio de salida:

- Usuarios y roles se administran con integridad referencial.
- La relacion M:N funciona y queda auditada.

### Fase 5 - Flujo de autenticacion y seleccion de rol

Objetivo: cumplir el flujo central del proyecto.

Pasos login:

1. Implementar `POST /api/auth/login`.
2. Validar credenciales con mensaje generico:
   - no decir si fallo usuario o password.
3. Aplicar rate limiting estricto.
4. Si las credenciales son validas, devolver:
   - `tempToken`
   - lista de roles activos del usuario
5. No emitir todavia el `accessToken` definitivo.

Pasos selector de rol:

1. Implementar `POST /api/auth/select-role`.
2. Validar firma y expiracion del `tempToken`.
3. Validar que `roleId` pertenezca al usuario.
4. Generar `accessToken` corto con solo el rol seleccionado.
5. Generar `refreshToken`.
6. Guardar hash del refresh token y `jti` en base.
7. Devolver tokens al frontend.
8. Registrar evento de seleccion de workspace/rol.

Pasos refresh:

1. Implementar `POST /api/auth/refresh-token`.
2. Validar refresh token contra hash persistido.
3. Rotar refresh token en cada uso.
4. Si se detecta reutilizacion, revocar la familia de tokens.
5. Emitir nuevo access token.

Pasos logout:

1. Implementar `POST /api/auth/logout`.
2. Revocar refresh token activo.
3. Invalidar `jti` si se mantiene blacklist temporal.
4. Responder siempre de forma segura aunque el token ya este revocado.

Pruebas:

1. Login correcto devuelve tempToken y roles.
2. Login incorrecto devuelve mensaje generico.
3. Usuario sin rol no puede continuar.
4. Select-role con rol ajeno devuelve 403.
5. Access token contiene un solo rol.
6. Refresh token rota.
7. Reutilizacion de refresh token revoca sesion.
8. Logout impide refrescar de nuevo.

Criterio de salida:

- El usuario no entra al dashboard sin seleccionar rol.
- El JWT definitivo representa solo el contexto de trabajo elegido.

### Fase 6 - Gestion de modulos y menus recursivos

Objetivo: implementar navegacion dinamica basada en rol.

Pasos modulos:

1. Implementar CRUD de modulos.
2. Implementar asignacion de modulo a rol.
3. Al inactivar un modulo, impedir que sus menus se rendericen.
4. Evitar duplicados rol-modulo activos.

Pasos menus:

1. Implementar tabla `menus` con adjacency list.
2. Permitir `parent_id = null` para menus raiz.
3. Permitir `url = null` en nodos agrupadores.
4. Exigir `url` en nodos hoja cuando aplique.
5. Implementar CRUD de menus.
6. Validar que el nuevo `parent_id` pertenezca al mismo modulo.
7. Validar que mover un nodo no genere ciclos.
8. Implementar soft delete de menu.
9. Si se inactiva un padre, excluir tambien sus hijos del arbol final.
10. Implementar asignacion de menu a rol.

Pasos arbol:

1. Implementar `GET /api/menus/tree`.
2. Extraer `roleId` del JWT.
3. Consultar menus activos asignados al rol y a modulos activos.
4. Usar CTE recursivo o consulta optimizada para evitar N+1.
5. Construir JSON jerarquico en memoria.
6. Retornar estructura:

```json
[
  {
    "id": "module-id",
    "nombre": "Ventas",
    "menus": [
      {
        "id": "menu-id",
        "nombre": "Ordenes",
        "url": null,
        "children": [
          {
            "id": "item-id",
            "nombre": "Crear Orden",
            "url": "/ventas/ordenes",
            "children": []
          }
        ]
      }
    ]
  }
]
```

Pruebas:

1. Rol A ve solo sus modulos.
2. Rol B no ve menus de Rol A.
3. Menu inactivo no aparece.
4. Modulo inactivo no aparece.
5. Nodo padre inactivo oculta hijos.
6. Movimiento ciclico de menu se rechaza.
7. La consulta no cae en N+1.

Criterio de salida:

- Backend devuelve un arbol completo de navegacion basado en el rol activo del JWT.

### Fase 7 - Frontend de autenticacion, selector y rutas dinamicas

Objetivo: crear la experiencia full-stack requerida.

Pasos login:

1. Crear pantalla `/login`.
2. Enviar credenciales a `POST /api/auth/login`.
3. Guardar `tempToken` solo para el paso de seleccion.
4. Redirigir a `/select-role`.
5. Mostrar errores genericos.

Pasos selector de workspace:

1. Crear pantalla `/select-role`.
2. Mostrar roles devueltos por el login.
3. Al seleccionar un rol, llamar a `POST /api/auth/select-role`.
4. Guardar access token de forma segura segun estrategia definida.
5. Redirigir a `/app`.
6. Si no hay tempToken valido, volver a login.

Pasos layout dinamico:

1. Al entrar a `/app`, llamar `GET /api/menus/tree`.
2. Renderizar sidebar desde el JSON recibido.
3. Registrar rutas dinamicas en Angular Router usando `Routes` y `router.resetConfig()`.
4. No hardcodear rutas de modulos administrativos.
5. Mostrar estado vacio si el rol no tiene menus.
6. Manejar `401` redirigiendo a login.
7. Manejar `403` mostrando pagina unauthorized.

Pasos sesion:

1. Interceptar access token expirado.
2. Llamar refresh token.
3. Si refresh falla, cerrar sesion local.
4. Implementar boton logout.

Pruebas:

1. Login no abre dashboard directamente.
2. Selector de rol es obligatorio.
3. Rutas aparecen segun menu del backend.
4. Rol sin permiso no puede navegar por URL manual.
5. Logout limpia estado y vuelve a login.

Criterio de salida:

- La navegacion del cliente se construye en tiempo de ejecucion a partir del Master.

### Fase 8 - Zero Trust para microservicios hijos

Objetivo: preparar integracion con servicios como Ventas sin duplicar usuarios.

Pasos Master:

1. Implementar `POST /api/internals/validate-token`.
2. Validar firma, expiracion, issuer, audience y `jti`.
3. Retornar solo datos necesarios:
   - `valid`
   - `userId`
   - `roleId`
   - permisos o menus necesarios
4. No exponer email, password hash ni datos sensibles.
5. Proteger el endpoint interno con estrategia adicional:
   - API key interna
   - mTLS si aplica
   - allowlist de servicios

Pasos microservicio hijo de ejemplo:

1. Crear servicio simple `ventas`.
2. Proteger `GET /ventas/ordenes`.
3. Recibir `Authorization: Bearer <token>`.
4. No confiar en el frontend.
5. Validar token llamando al Master o usando llave publica.
6. Si el usuario no tiene permiso, devolver 403.
7. Si el token es invalido, devolver 401.
8. Agregar retry cuando el Master en PaaS gratuito este despertando.

Pruebas:

1. Token valido con rol autorizado accede.
2. Token valido sin permiso recibe 403.
3. Token expirado recibe 401.
4. Servicio hijo no consulta tabla local de usuarios.
5. Servicio hijo tolera latencia inicial del Master con reintentos controlados.

Criterio de salida:

- Existe al menos una integracion demostrable donde un microservicio hijo delega identidad y autorizacion al Master.

### Fase 9 - Shift-Left Security en codigo

Objetivo: integrar seguridad durante desarrollo, no al final.

Pasos:

1. Activar validacion fuerte en todos los DTO.
2. Sanitizar entradas que se muestren en UI.
3. Usar exclusivamente ORM para acceso a datos.
4. Prohibir SQL por concatenacion.
5. Si se usa raw SQL para CTE, hacerlo parametrizado y encapsulado.
6. Configurar Helmet.
7. Configurar CORS con origen especifico, no wildcard en produccion.
8. Configurar rate limiting en login y refresh.
9. Usar Argon2id o Bcrypt con costo apropiado.
10. Mover todos los secrets a variables de entorno.
11. Agregar validacion de variables de entorno al arranque.
12. Agregar pruebas de seguridad:

- intento de SQL injection
- acceso a rol ajeno
- acceso a menu ajeno
- token expirado
- refresh reutilizado
- password debil

1. Agregar analisis de dependencias vulnerables.

Criterio de salida:

- Los riesgos Broken Access Control, SQL Injection, filtracion de secretos y password storage inseguro quedan cubiertos por codigo y pruebas.

### Fase 10 - Observabilidad, auditoria y trazabilidad

Objetivo: poder demostrar quien hizo que y detectar fallos.

Pasos:

1. Registrar logs estructurados.
2. Incluir request id por peticion.
3. Loguear eventos relevantes:
   - login exitoso
   - login fallido
   - seleccion de rol
   - refresh token
   - reuse detectado
   - logout
   - asignacion de rol
   - cambios en menus
4. Evitar loguear passwords, tokens o secrets.
5. Crear endpoints de health:
   - `GET /api/health`
   - `GET /api/health/db`
6. Documentar evidencias para la entrega.

Criterio de salida:

- El sistema deja evidencia util sin exponer informacion sensible.

### Fase 11 - CI/CD y DevSecOps

Objetivo: cumplir el anexo de infraestructura y seguridad.

Pasos estrategia de ramas:

1. Proteger `main`.
2. Permitir merges a `main` solo desde `test`.
3. Usar `dev` para integracion de features.
4. Crear pull requests para cada feature.

Pasos GitHub Actions:

1. Crear `.github/workflows/ci-cd.yml`.
2. Ejecutar en pushes y pull requests relevantes.
3. En `dev` y `test`, ejecutar:
   - install
   - lint
   - unit tests
   - build
4. En `main`, ejecutar secuencia completa:
   - notificar inicio a Telegram
   - build
   - unit tests
   - SonarCloud
   - validar Quality Gate
   - SAST avanzado o script ML
   - despliegue CLI
   - notificar resultado a Telegram

Pasos SonarCloud:

1. Crear proyecto en SonarCloud.
2. Configurar `SONAR_TOKEN` en GitHub Secrets.
3. Configurar coverage.
4. Bloquear despliegue si Quality Gate falla.

Pasos SAST avanzado / ML:

1. Crear script `security/ml_sast_check`.
2. Detectar archivos modificados `.ts`, `.js`, `.py`.
3. Ejecutar modelo open-source o API tipo CodeBERT fine-tuned.
4. Retornar codigo `0` si no detecta riesgo.
5. Retornar codigo `1` si detecta vulnerabilidad.
6. Enviar alerta a Telegram si falla.
7. Documentar limitaciones del modelo.

Pasos Telegram:

1. Crear bot con BotFather.
2. Obtener chat id del grupo.
3. Guardar secrets:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
4. Notificar:
   - inicio pipeline main
   - exito o fallo SonarCloud
   - alerta SAST/ML
   - exito o fallo despliegue
   - merges exitosos a dev y test

Pasos despliegue:

1. Elegir Railway o Render.
2. Configurar CLI en GitHub Actions.
3. Guardar tokens del PaaS en GitHub Secrets.
4. Ejecutar migraciones antes o durante deploy segun plataforma.
5. Desplegar solo si pruebas y analisis pasan.
6. Documentar latencia por sleep del plan gratuito.

Criterio de salida:

- Un merge a `main` dispara el pipeline completo y solo despliega si las validaciones de seguridad pasan.

### Fase 12 - Documentacion de entrega

Objetivo: preparar evidencia clara para revision academica.

Pasos:

1. Actualizar `README.md` con:
   - descripcion
   - stack
   - instalacion
   - variables de entorno
   - comandos
   - usuario seed
2. Crear `docs/arquitectura.md`.
3. Crear `docs/modelo-datos.md`.
4. Crear `docs/endpoints.md`.
5. Crear `docs/seguridad.md`.
6. Crear `docs/ci-cd.md`.
7. Agregar capturas:
   - login
   - selector de rol
   - dashboard con menu dinamico
   - pipeline exitoso
   - Telegram notificando
   - SonarCloud Quality Gate
8. Agregar coleccion Postman o archivo HTTP.
9. Documentar limitaciones:
   - sleep de Render/Railway gratuito
   - alcance del modelo ML
   - decisiones sobre JWT simetrico/asimetrico

Criterio de salida:

- Cualquier revisor puede ejecutar, probar y entender el sistema sin explicacion verbal adicional.

### Fase 13 - Pruebas de aceptacion final

Objetivo: verificar el cumplimiento completo del PDF.

Checklist funcional:

- Login valida credenciales.
- Login devuelve `tempToken` y roles.
- Usuario debe seleccionar rol antes del dashboard.
- Select-role emite JWT final.
- JWT final contiene solo el rol activo.
- Usuarios CRUD completo.
- Roles CRUD completo.
- Usuarios y roles M:N funcionando.
- Modulos CRUD completo.
- Roles y modulos asociados.
- Menus recursivos en una sola tabla.
- Roles y menus asociados.
- Frontend renderiza menu desde backend.
- No hay rutas administrativas hardcodeadas.
- Microservicio hijo valida token contra Master.

Checklist seguridad:

- Todos los endpoints protegidos excepto login y flujo estrictamente necesario.
- Rate limiting en login.
- Mensajes de login genericos.
- Passwords hasheados.
- Secrets fuera del codigo.
- ORM usado para consultas.
- Raw SQL, si existe, esta parametrizado.
- Soft delete aplicado.
- Auditoria aplicada.
- Refresh token rota.
- Reutilizacion de refresh token revoca sesion.
- Token expirado devuelve 401.
- Rol sin permiso devuelve 403.
- SAST ejecuta en CI.
- SonarCloud bloquea deploy si falla.

Checklist infraestructura:

- Ramas `main`, `test`, `dev`.
- Pull requests hacia ramas protegidas.
- GitHub Actions configurado.
- Telegram notifica eventos.
- Deploy por CLI, no solo webhook.
- Variables de entorno en GitHub Secrets.
- README documenta limitaciones del PaaS gratuito.

Criterio de salida:

- El proyecto puede demostrarse de punta a punta: login, rol, menu, autorizacion, microservicio hijo y pipeline seguro.

## 7. Orden recomendado de trabajo por entregables

Entrega 1:

1. Repositorio, ramas y estructura base.
2. Docker Compose con PostgreSQL.
3. Backend y frontend levantando.
4. Modelo Prisma y migraciones.
5. Seed inicial.

Entrega 2:

1. Usuarios CRUD.
2. Roles CRUD.
3. Usuario-rol M:N.
4. Hash de password.
5. Auditoria y soft delete.

Entrega 3:

1. Login.
2. TempToken.
3. Selector de rol.
4. Access token y refresh token.
5. Guards backend.
6. Pantallas login y select-role.

Entrega 4:

1. Modulos CRUD.
2. Menus recursivos.
3. Asignacion menu-rol.
4. `GET /api/menus/tree`.
5. Sidebar dinamico frontend.

Entrega 5:

1. Microservicio hijo de ejemplo.
2. `POST /api/internals/validate-token`.
3. Validacion Zero Trust.
4. Pruebas 401 y 403.

Entrega 6:

1. Pruebas unitarias e integracion.
2. SAST local.
3. SonarCloud.
4. Pipeline GitHub Actions.
5. Telegram bot.
6. Deploy Railway/Render por CLI.

Entrega 7:

1. Documentacion final.
2. Evidencias.
3. Pruebas de aceptacion.
4. Demo completa.

## 8. Riesgos y mitigaciones

Riesgo: menus recursivos generan N+1.

Mitigacion: usar CTE recursivo parametrizado o consulta plana optimizada y armar arbol en memoria.

Riesgo: el frontend termina con rutas hardcodeadas.

Mitigacion: permitir solo rutas base y registrar rutas de negocio desde `GET /api/menus/tree`.

Riesgo: JWT incluye permisos de todos los roles.

Mitigacion: emitir token solo despues de `select-role` y solo con `roleId` activo.

Riesgo: microservicio hijo confia en el frontend.

Mitigacion: el hijo siempre valida token con Master o llave publica.

Riesgo: secrets filtrados en repo.

Mitigacion: `.env.example`, GitHub Secrets y escaneo de secrets en CI.

Riesgo: refresh token reutilizado por robo.

Mitigacion: rotacion, hash persistido, `jti` y revocacion por reutilizacion.

Riesgo: inconsistencia hard delete vs auditoria en tabla pivote.

Mitigacion: usar soft revoke con auditoria o tabla de eventos si se exige delete fisico.

## 9. Definicion final de exito

El proyecto esta listo cuando:

1. Un usuario puede iniciar sesion.
2. El sistema obliga a escoger rol.
3. El JWT definitivo queda limitado a ese rol.
4. El frontend carga menu y rutas desde backend.
5. Un usuario no puede ver ni llamar recursos de otro rol.
6. Un microservicio hijo valida tokens mediante el Master.
7. El sistema tiene auditoria, soft delete, hash de passwords y secrets externos.
8. El pipeline ejecuta build, pruebas, SonarCloud, SAST/ML, Telegram y deploy por CLI.
9. La documentacion permite reproducir la demo completa.
