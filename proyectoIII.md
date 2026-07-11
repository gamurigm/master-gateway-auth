
## Universidad de las Fuerzas Armadas ESPE

### Departamento de Ciencias de la Computaci ́on

```
Carrera de Ingenier ́ıa en Software
```

```
Desarrollo de Software Seguro
```

## Proyecto Integrador Parcial III

### Docente: Geovanny Cudco

### 30 de junio de 2026

## 1. Tema

```
Sistema de Autenticaci ́on y Autorizaci ́on Centralizado (Master Gateway)
```

## 2. Descripci ́on General

En la actualidad, el desarrollo de aplicaciones empresariales ha evolucionado hacia
arquitecturas de microservicios para garantizar escalabilidad, independencia de desplie-
gue y diversidad tecnol ́ogica. Sin embargo, esta descentralizaci ́on trae consigo un desaf ́ıo
cr ́ıtico: la fragmentaci ́on de la identidad y el control de acceso.
Cuando cada microservicio implementa su propio mecanismo de autenticaci ́on y au-
torizaci ́on, se generan silos de seguridad, duplicaci ́on de c ́odigo, inconsistencias en la ges-
ti ́on de roles y una experiencia de usuario fragmentada. Adem ́as, la integraci ́on de nuevos
m ́odulos al ecosistema se vuelve lenta y propensa a errores de configuraci ́on, exponiendo
vulnerabilidades cr ́ıticas (como Broken Access Control).
El problema fundamental radica en la falta de un ”Microservicio Maestro (Mas-
ter)”que act ́ue como el eje centralizador de la identidad. Se necesita un sistema que no
solo valide ”qui ́en.esel usuario (Autenticaci ́on), sino ”qu ́e”puede hacer y ”d ́onde”puede ir
(Autorizaci ́on din ́amica), bas ́andose en una estructura de men ́us recursiva que se adapte
intr ́ınsecamente a los m ́odulos asignados a sus roles.
Para solventar esto, el proyecto exige la construcci ́on de un m ́odulo Full-Stack bajo
los principios de Shift-Left (integraci ́on de seguridad desde las primeras fases de dise ̃no
y codificaci ́on) y Zero Trust (”Nunca confiar, siempre verificar”; asumiendo que la red
interna es hostil y requiriendo validaci ́on continua).

## 3. Objetivo General

```
Desarrollar un microservicio maestro de autenticaci ́on y autorizaci ́on Full-Stack que
centralice la gesti ́on de identidades, roles y navegaci ́on, sirviendo como gateway de segu-
ridad y enrutamiento para un ecosistema de microservicios.
```

### 3.1. Objetivos Espec ́ıficos

OE 1 Implementar un modelo de datos relacional que soporte relaciones Many-to-Many
entre Usuarios y Roles.

OE 2 Dise ̃nar una estructura de men ́us din ́amica y recursiva (almacenada en una sola
tabla) que represente M ́odulos, Submen ́us e Items, asociada directamente a
roles.

OE 3 Desarrollar el flujo de inicio de sesi ́on donde el usuario seleccione activamente el rol
con el que desea operar, cargando ́unicamente el m ́odulo y men ́u asociados a dicha
elecci ́on.

OE 4 Configurar una arquitectura preparada para la integraci ́on de futuros microservi-
cios (ej. M ́odulo de Ventas), donde el microservicio maestro emita y valide tokens
(JWT/OAuth2 ) bajo el modelo Zero Trust.

OE 5 Aplicar el enfoque Shift-Left mediante pruebas de seguridad unitarias, validaci ́on
de entradas (sanitizaci ́on), protecci ́on contra inyecci ́on SQL (v ́ıa ORM) y cifrado
de contrase ̃nas.

## 4. Arquitectura y Modelo de Datos

### 4.1. Modelo Entidad-Relaci ́on

```
A continuaci ́on se describen las principales relaciones que rigen el modelo de datos
del microservicio maestro:
```

```
Usuarios ←→ Roles
```

```
Relaci ́on M : N — Un usuario puede tener m ́ultiples roles asignados y, a su vez, un
rol puede estar asignado a m ́ultiples usuarios. Esta relaci ́on se materializa mediante una
tabla intermedia (join table) que almacena los pares usuarioid – rolid.
```

```
Roles ←→ M ́odulos
```

```
Relaci ́on 1 : N o M : N — Un rol puede tener acceso a uno o varios m ́odulos admi-
nistrativos. Si se requiere granularidad fina (por ejemplo, un m ́odulo compartido por
varios roles con distintos permisos), se adopta el modelo M : N con tabla intermedia; de
lo contrario, basta con una clave for ́anea rolid en la tabla de m ́odulos.
```

Men ́us (Estructura Recursiva)

Se emplea una ́unica tabla Menu definida por los siguientes campos:

```
Campo Descripci ́on
id Identificador ́unico del registro.
nombre Etiqueta visible en la interfaz (ej. Ventas, Re-
portes ).
url Ruta hacia el microservicio destino. Solo se
completa en nodos hoja (Items).
moduloid Clave for ́anea que vincula el men ́u con su m ́odu-
lo padre.
parentid Referencia al id de otro registro de la misma
tabla. Si es NULL, el nodo es un Men ́u Princi-
pal; si tiene valor, es un Submen ́u o Item.
```

De esta forma, ́unicamente los nodos hoja (aquellos que no tienen hijos) contendr ́an
el enlace (url) hacia el nuevo microservicio, mientras que los nodos intermedios act ́uan
como agrupadores jer ́arquicos.

### 4.2. Uso de Tecnolog ́ıas

Frameworks

Se deber ́an utilizar frameworks modernos y robustos que faciliten la creaci ́on de
estructuras seguras y modulares. Algunas opciones recomendadas son:

- NestJS — Basado en TypeScript, con decoradores, inyecci ́on de dependencias y
  m ́odulos nativos de seguridad (guards, interceptors, pipes ).
- Spring Boot — Ecosistema Java maduro con Spring Security para autentica-
  ci ́on/autorizaci ́on declarativa.
- FastAPI — Framework Python de alto rendimiento con validaci ́on autom ́atica
  mediante Pydantic y soporte nativo para OAuth2.
- Django — Incluye un sistema de autenticaci ́on integrado y middleware extensible
  para l ́ogica de seguridad.

ORMs

```
Es obligatorio el uso de un Object-Relational Mapper (ORM) con el fin de:
```

1. Abstraer la base de datos: Evitar escribir consultas SQL en bruto, logrando
   independencia del motor subyacente (PostgreSQL, MySQL, etc.).
2. Prevenir inyecci ́on SQL: Todas las consultas se construyen mediante par ́ame-
   tros vinculados internamente por el ORM, eliminando la posibilidad de inyecci ́on.
3. Facilitar consultas recursivas: Permitir la ejecuci ́on de Common Table Expres-
   sions (CTE) generadas autom ́aticamente por el ORM para recorrer la estructura
   jer ́arquica de la tabla Menu.

Algunas opciones recomendadas de ORMs compatibles con los frameworks menciona-
dos:

```
Ecosistema ORM Sugerido
Node.js / NestJS Prisma, TypeORM
Java / Spring Boot Hibernate, Spring Data JPA
Python / FastAPI SQLAlchemy, Tortoise ORM
Python / Django Django ORM (integrado)
.NET Entity Framework Core
```

## 5. Requisitos Funcionales Espec ́ıficos

### 5.1. Gesti ́on de Identidad

CRUD completo para Usuarios y Roles, manejando adecuadamente la tabla pivote
intermedia que materializa la relaci ́on M : N entre ambas entidades. Todas las opera-
ciones de creaci ́on, lectura, actualizaci ́on y eliminaci ́on deben garantizar la integridad
referencial y la consistencia transaccional.

### 5.2. Gesti ́on de M ́odulos y Men ́us

- Creaci ́on de M ́odulos: Registro de unidades funcionales del sistema (ej. Ventas,
  Recursos Humanos, Financiero).
- Asignaci ́on de M ́odulos a Roles: Vinculaci ́on que determina qu ́e roles tienen
  visibilidad sobre qu ́e m ́odulos administrativos.
- CRUD de Men ́us con patr ́on Adjacency List: Implementaci ́on del men ́u en
  una ́unica tabla utilizando el patr ́on Adjacency List (lista de adyacencia), donde
  cada registro referencia a su nodo padre mediante parentid, soportando as ́ı la
  recursividad de forma eficiente sin necesidad de m ́ultiples tablas.

### 5.3. Pantalla de “Espacio de Trabajo” (Workspace Selector )

Posterior al login cl ́asico (credenciales v ́alidas), el sistema debe impedir la carga
directa del dashboard. En su lugar, se debe forzar la selecci ́on expl ́ıcita del rol con
el que el usuario desea operar en esa sesi ́on. Esta selecci ́on permite:

- Delimitar el contexto de seguridad de toda la sesi ́on.
- Implementar Tenant/Rol Isolation a nivel de sesi ́on, garantizando que cada instan-
  cia de trabajo est ́e aislada y acotada exclusivamente a los permisos del rol seleccio-
  nado.

### 5.4. Enrutamiento Basado en Men ́u

El Frontend no debe tener las rutas hardcodeadas. En su lugar, debe construirlas
din ́amicamente a partir del JSON del men ́u devuelto por el microservicio Master tras
la selecci ́on del rol. Esto implica que la estructura de navegaci ́on completa —m ́odulos,
submen ́us e items— es determinada en tiempo de ejecuci ́on por el backend, eliminando
cualquier dependencia est ́atica del cliente.

## 6. Requisitos No Funcionales y de Seguridad (Shift-

## Left & Zero Trust )

### 6.1. Zero Trust Architecture (ZTA)

- Validaci ́on obligatoria en cada endpoint: Todos los endpoints del sistema
  deben requerir un token v ́alido; no existen rutas o recursos de acceso p ́ublico una
  vez autenticado el flujo.
- Delegaci ́on de confianza al Master: Los microservicios hijos (futuros, ej. M ́odulo
  de Ventas) no deben tener su propia base de datos de usuarios. Deben
  cumplir una de las siguientes estrategias:

```
a. Validaci ́on directa: Llamar al microservicio Master para validar el token
en cada petici ́on.
b. Validaci ́on asim ́etrica (opcional): Compartir una clave criptogr ́afica asim ́etri-
ca (par p ́ublica/privada) que permita al microservicio hijo validar la firma
del JWT sin necesidad de comunicaci ́on directa con el Master, re-
duciendo latencia y acoplamiento.
```

### 6.2. Principio de Menor Privilegio (Least Privilege)

El token generado al seleccionar el rol solo debe contener los permisos estricta-
mente necesarios para ese rol. No se incluyen permisos globales del usuario, ni de otros
roles que pudiera tener asignados. Esto minimiza el impacto en caso de compromiso del
token.

### 6.3. Shift-Left Security

- An ́alisis est ́atico de c ́odigo (SAST): Integrado en el pipeline de CI/CD desde
  el primer d ́ıa de desarrollo, detectando vulnerabilidades antes de que el c ́odigo
  llegue a producci ́on.
- Consultas parametrizadas exclusivas: Todo acceso a datos debe realizarse ex-
  clusivamente a trav ́es del ORM con consultas parametrizadas. Queda prohibida
  la concatenaci ́on de cadenas (string interpolation) para construir consultas SQL.
- Hash de contrase ̃nas robusto: Almacenamiento de contrase ̃nas utilizando algo-
  ritmos de hash lentos y adaptativos, tales como Argon2 o Bcrypt con un alto
  factor de costo (cost factor ), resistente a ataques de fuerza bruta.
- Gesti ́on segura de Secrets: Todas las credenciales, claves y tokens deben al-
  macenarse mediante variables de entorno o gestores de secrets (ej. Vault, AWS
  Secrets Manager ). Queda totalmente prohibido el hardcodeo de secrets en el
  c ́odigo fuente.

### 6.4. Performance

Las consultas recursivas del men ́u deben estar optimizadas para evitar el problema
cl ́asico de consultas N+1. Se deber ́an preferir t ́ecnicas de carga en ́arbol proporcionadas
por el ORM o el uso de Common Table Expressions (CTE) nativas de la base de datos,
garantizando tiempos de respuesta predecibles independientemente de la profundidad del
men ́u.

## 7. Consideraciones para el Desarrollo

### 7.1. Base de Datos

Se sugiere emplear PostgreSQL o MySQL, dado que ambos motores ofrecen so-
porte nativo y eficiente para consultas jer ́arquicas recursivas (CTE con la cl ́ausula
WITH RECURSIVE en PostgreSQL; CTE recursivas disponibles desde MySQL 8.0), lo cual
es fundamental para la tabla de men ́us con patr ́on Adjacency List.

### 7.2. Estado de la Sesi ́on

Se optar ́a por una arquitectura Stateless en el servidor mediante el uso de tokens
JWT (JSON Web Tokens ). Esta decisi ́on garantiza que el microservicio Master no co-
lapse bajo carga a medida que se a ̃nadan m ́as microservicios al ecosistema, ya que no es
necesario mantener estado de sesi ́on en memoria ni en base de datos del lado del servidor.

### 7.3. Frontend

```
El cliente debe ser una SPA (Single Page Application) capaz de:
```

- Interceptar las respuestas de la API del men ́u provenientes del Master tras la
  selecci ́on del rol.
- Inyectar rutas din ́amicamente al enrutador del framework utilizado (ej. Vue
  Router para Vue.js, React Router para React, Angular Router para Angular), de
  modo que la navegaci ́on se construya en tiempo de ejecuci ́on sin dependencias est ́ati-
  cas en el c ́odigo fuente del cliente.

## 8. Diagramas de Secuencia8.1. Flujo de Autenticaci ́on y Selecci ́on de Rol

```
Figura 1: Diagrama de secuencia
```

### 8.2. Flujo de Carga Din ́amica del Men ́u Recursivo

```
Figura 2: Diagrama de secuencia
```

### 8.3. lujo de Integraci ́on con Microservicio Hijo (Ej. Ventas) - Zero Trust

```
Figura 3: Diagrama de secuencia
```

## 9. Especificaci ́on de Endpoints del Microservicio Maes-

## tro

A continuaci ́on, se presenta la especificaci ́on de los endpoints m ́ınimos requeridos para
el Microservicio Maestro.
Previo a la tabla, es fundamental definir el Patr ́on de Auditor ́ıa y Estado Global,
el cual aplica de manera estricta para todas y cada una de las entidades de la base de
datos (Usuarios, Roles, M ́odulos, Men ́us), garantizando trazabilidad y eliminaci ́on l ́ogica.

### Est ́andar de Campos Obligatorios por Entidad (ORM)

Cualquier tabla creada a trav ́es del ORM debe heredar o incluir los siguientes campos
por defecto:

- id: UUID o Auto-incremental (Seg ́un estrategia DB).
- estado: Booleano o Enum (ACTIVO, INACTIVO). Nunca se debe eliminar f ́ısica-
  mente un registro (DELETE duro), se debe hacer un Soft Delete actualizando
  este campo a INACTIVO.
- fechacreacion: Timestamp autom ́atico en el momento de la inserci ́on (Managed
  by ORM).
- fechaactualizacion: Timestamp autom ́atico que se actualiza en cada UPDATE
  (Managed by ORM).
- creadopor: UUID del usuario que cre ́o el registro (Null si es auto-registro).
- actualizadopor: UUID del usuario que modific ́o el registro por ́ultima vez.

### Tabla de Endpoints M ́ınimos de la Aplicaci ́on

```
Dominio
```

#### /

```
Recurso
```

```
M ́etodoHTTP
```

```
Endpoint
```

```
Descripci ́on
```

```
Seguridad / Negocio
```

#### AUTENTICACI

#### ́ON

```
Inicio de Se-si ́on
```

#### POST

```
/api/auth/login
```

```
Valida credenciales, de-vuelve TempToken y listade roles del usuario.
```

```
Rate limiting estricto. Nodebe revelar si el usuarioo la contrase ̃na es el in-correcto (mensaje gen ́eri-co).
```

```
Selecci ́on deRol
```

#### POST

```
/api/auth/select-role
```

```
Recibe
```

```
TempToken
```

```
y
```

```
roleId
```

```
, devuelve JWT
```

```
definitivo.
```

```
El JWT emitido debe te-ner tiempo de expiraci ́oncorto (Zero Trust).
```

```
Renovar To-ken
```

#### POST

```
/api/auth/refresh-token
```

```
Genera un nuevo JWTusando un Refresh Tokenv ́alido.
```

```
Revocaci ́on inmediata sise detecta reutilizaci ́onde un Refresh Token.
```

```
Cerrar Sesi ́on
```

#### POST

```
/api/auth/logout
```

```
Invalida los tokens delusuario en la base de da-tos/Redis.
```

```
Necesario para cortar lasesi ́on de inmediato encaso de compromiso.
```

#### VALIDACI

#### ́ON INTERNA

```
Validar
```

```
To-
```

```
ken
```

#### POST

```
/api/internals/validate-token
```

```
Endpoint privado paraque otros microserviciosvaliden el JWT.
```

```
No expone datos sensi-bles, solo confirma vali-dez, userId y roleId.
```

#### USUARIOS

```
Contin ́ua en la siguiente p ́agina...
```

Continuaci ́on de la Tabla de Endpoints M ́ınimos

```
Dominio
```

#### /

```
Recurso
```

```
M ́etodoHTTP
```

```
Endpoint
```

```
Descripci ́on
```

```
Seguridad / Negocio
```

```
Listar Usua-rios
```

#### GET

```
/api/users
```

```
Obtiene lista paginada deusuarios.
```

```
Filtros obligatorios porestado = ACTIVO
```

#### 

```
ObtenerUsuario
```

#### GET

```
/api/users/
```

```
{id
```

#### }

```
Obtiene detalle de unusuario espec ́ıfico.
```

```
Ocultar campo de con-trase ̃na hasheada en laserializaci ́on (ORM).
```

```
Crear Usua-rio
```

#### POST

```
/api/users
```

```
Registra un nuevo usua-rio (Hash de contrase ̃na).
```

```
Validaci ́on
```

```
fuerte
```

```
de
```

```
contrase ̃na
```

```
(Shift-
```

```
Left). El ORM asignafecha
```

```
creacion
```

#### 

```
ActualizarUsuario
```

#### PUT

```
/api/users/
```

```
{id
```

#### }

```
Actualiza datos de unusuario.
```

```
El
```

#### ORM

```
actuali-
```

```
za
```

```
autom ́aticamente
```

```
fecha
```

```
actualizacion
```

```
y
```

```
actualizado
```

```
por
```

#### 

```
EliminarUsuario
```

#### DELETE

```
/api/users/
```

```
{id
```

#### }

```
Eliminaci ́on l ́ogica delusuario.
```

```
NO borra el regis-tro
```

```
, cambia
```

```
estado
```

```
a
```

#### INACTIVO

#### 

```
ROLESListar Roles
```

#### GET

```
/api/roles
```

```
Obtiene todos los rolesactivos.
```

#### —

```
Contin ́ua en la siguiente p ́agina...
```

Continuaci ́on de la Tabla de Endpoints M ́ınimos

```
Dominio
```

#### /

```
Recurso
```

```
M ́etodoHTTP
```

```
Endpoint
```

```
Descripci ́on
```

```
Seguridad / Negocio
```

```
Crear Rol
```

#### POST

```
/api/roles
```

```
Crea un nuevo rol en elsistema.
```

#### —

```
ActualizarRol
```

#### PUT

```
/api/roles/
```

```
{id
```

#### }

```
Modifica
```

```
nombre/des-
```

```
cripci ́on del rol.
```

#### —

```
Eliminar Rol
```

#### DELETE

```
/api/roles/
```

```
{id
```

#### }

```
Eliminaci ́on l ́ogica delrol.
```

```
Prevenir eliminaci ́on siest ́a asignado a usuariosactivos.
```

```
Asignar Rol aUsuario
```

#### POST

```
/api/roles/
```

```
{id
```

```
}/users
```

```
Asocia un usuario exis-tente a este rol (M:N).
```

```
Registra en la tabla pivo-te con sus propios cam-pos de auditor ́ıa.
```

```
DesasignarRol
```

#### DELETE

```
/api/roles/
```

```
{id
```

```
}/users/
```

```
{userId
```

#### }

```
Rompe la relaci ́on M:N(Eliminaci ́on f ́ısica en latabla pivote).
```

#### —

#### M

#### ́ODULOS

```
GestionarM ́odulos
```

#### GETPOSTPUT

#### DELETE

```
/api/modules/api/modules/
```

```
{id
```

#### }

```
CRUD est ́andar para losm ́odulos administrativos(Ej: “Ventas”).
```

```
Al inactivar un m ́odulo,sus men ́us asociados nodeben renderizarse.
```

```
Contin ́ua en la siguiente p ́agina...
```

Continuaci ́on de la Tabla de Endpoints M ́ınimos

```
Dominio
```

#### /

```
Recurso
```

```
M ́etodoHTTP
```

```
Endpoint
```

```
Descripci ́on
```

```
Seguridad / Negocio
```

```
AsignarM ́odulo
```

```
a
```

```
Rol
```

#### POST

```
/api/roles/
```

```
{id
```

```
}/modules
```

```
Vincula un m ́odulo com-pleto a un rol.
```

#### —

#### MEN

```
́US (Recursivos)
```

```
Obtener ́Arbol
```

```
de
```

```
Men ́u
```

#### GET

```
/api/menus/tree
```

```
Devuelve la estructurajer ́arquica completa ba-sada en el rol del JWT.
```

```
Cr ́ıtico:
```

```
El ORM de-
```

```
be usar CTE (
```

```
Common
```

```
Table Expressions
```

```
) para
```

```
resolver la recursividad(parent
```

```
id
```

#### )

```
Crear
```

```
́Item
```

```
de Men ́u
```

#### POST

```
/api/menus
```

```
Crea Men ́u, Submen ́u oItem.
```

```
Requiere
```

```
recibir
```

```
parent
```

```
id
```

```
(null si es
```

```
ra ́ız) y
```

```
url
```

```
(null si no es
```

```
hoja/item final).
```

```
Actualizar ́Item
```

```
de
```

```
Men ́u
```

#### PUT

```
/api/menus/
```

```
{id
```

#### }

```
Modifica texto, url o pa-dre del men ́u.
```

```
Validar que el nuevoparent
```

```
id
```

```
no genere un
```

```
bucle infinito (referenciac ́ıclica).
```

```
Eliminar ́Item
```

```
de
```

```
Men ́u
```

#### DELETE

```
/api/menus/
```

```
{id
```

#### }

```
Eliminaci ́on l ́ogica delmen ́u.
```

```
Si se elimina un padre, lal ́ogica de frontend/bac-kend debe ignorar los hi-jos.
```

```
Contin ́ua en la siguiente p ́agina...
```

Continuaci ́on de la Tabla de Endpoints M ́ınimos

```
Dominio
```

#### /

```
Recurso
```

```
M ́etodoHTTP
```

```
Endpoint
```

```
Descripci ́on
```

```
Seguridad / Negocio
```

```
AsignarMen ́u a Rol
```

#### POST

```
/api/roles/
```

```
{id
```

```
}/menus
```

```
Asigna
```

```
un
```

```
Item/Sub-
```

```
men ́u espec ́ıfico a unrol.
```

#### —

### Notas de Implementaci ́on para el Desarrollador

1. Gesti ́on de Auditor ́ıa en el ORM: En frameworks como NestJS (con Ty-
   peORM/Prisma) o Python (con SQLAlchemy), se deben implementar Hooks del
   ciclo de vida del ORM (ej. @BeforeUpdate, @BeforeInsert) para garantizar que
   fechaactualizacion y estado no puedan ser manipulados manualmente desde
   el controlador, reforzando el enfoque Shift-Left.
2. Soft Deletes en Consultas: Todas las entidades deben tener configurado un
   Global Scope o filtro autom ́atico a nivel de ORM (ej. where: { estado: ’ACTIVO’
   }) para que un desarrollador no deba escribirlo manualmente en cada endpoint y
   evitar filtrar datos inactivos por error.
3. Seguridad en la Tabla Pivote (M:N): La tabla intermedia (ej. userhasroles)
   no es una tabla tonta; tambi ́en debe heredar los campos de auditor ́ıa (fechacreacion,
   estado) para saber cu ́ando se le otorg ́o o revoc ́o un permiso a un usuario espec ́ıfi-
   co.

# Anexo: Requisitos de Infraestructura, CI/CD

# y DevSecOps

## Estrategia de Ramas (Git Branching Strategy)

```
El repositorio en GitHub debe regirse estrictamente por el siguiente modelo de ramas:
```

- main: Rama de producci ́on. El c ́odigo aqu ́ı debe ser inmutable excepto mediante
  Pull Requests desde test.Unicamente los merges en esta rama disparan el ́
  despliegue autom ́atico.
- test: Rama de pruebas/QA. Aqu ́ı se integran las funcionalidades para ser validadas
  por el equipo de calidad o el cliente. Los Pull Requests hacia main nacen de aqu ́ı.
- dev: Rama de desarrollo. Los desarrolladores crean ramas feature (ej. feature/auth-login)
  a partir de dev y hacen Pull Requests de vuelta a dev para integraci ́on continua.

## Pipeline CI/CD con GitHub Actions

Se debe configurar un archivo de flujo de trabajo (.github/workflows/ci-cd.yml)
que ejecute los siguientes pasos de forma secuencial al realizar un push o merge en la
rama main:

1. Build y Pruebas Unitarias: Compilaci ́on del proyecto y ejecuci ́on de pruebas.
2. An ́alisis Est ́atico Tradicional (SonarCloud): Integraci ́on con SonarCloud para
   evaluar la calidad del c ́odigo (Code Smells, Bugs, Vulnerabilidades conocidas y
   Cobertura de Pruebas). Se debe exigir que el Quality Gate pase para continuar.
3. An ́alisis SAST Avanzado (Modelo de Miner ́ıa de Datos/ML): Ejecuci ́on
   de un contenedor Docker o script de Python que aloje un modelo de Machine
   Learning pre-entrenado. Este modelo analizar ́a los cambios en el c ́odigo buscando
   patrones an ́omalos o vulnerabilidades l ́ogicas complejas que las reglas est ́aticas de
   SonarCloud no detectan.
4. Despliegue Autom ́atico: Si los pasos 2 y 3 son exitosos, el pipeline ejecutar ́a los
   comandos de la CLI del proveedor cloud para desplegar la nueva versi ́on.

## Infraestructura Cloud (Despliegue Autom ́atico)

El microservicio maestro debe desplegarse en un servicio de plataforma como servicio
(PaaS) gratuito orientado a desarrolladores, como Railway o Render.

- Requisito: El despliegue debe ser triggered por la CLI en el pipeline de GitHub
  Actions (no solo por webhook autom ́atico del repositorio), para asegurar que el
  c ́odigo desplegado haya pasado los an ́alisis de seguridad previamente.
- Gesti ́on de Variables de Entorno: Las credenciales de base de datos y claves
  criptogr ́aficas (JWT Secret) deben inyectarse desde los Secrets de GitHub Actions
  al entorno del PaaS, nunca almacenarse en el c ́odigo.

## Sistema de Notificaciones (Telegram Bot)

Se debe crear un Bot de Telegram (v ́ıa BotFather) e integrar su token en los secretos
del repositorio. El pipeline debe utilizar la API de Telegram para enviar mensajes a un
grupo espec ́ıfico (donde est ́en todos los integrantes del equipo).
Eventos a notificar:

- Inicio del Pipeline en main.
- Exito o fracaso del ́ Quality Gate de SonarCloud.
- Alertas cr ́ıticas si el Modelo de Miner ́ıa de Datos detecta patrones sospechosos de
  vulnerabilidades.
- Estado del despliegue en Railway/Render (Exito o Fallo). ́
- Merges exitosos hacia las ramas dev y test.

## Diagrama de Secuencia: Pipeline CI/CD y Despliegue

El siguiente diagrama ilustra el comportamiento automatizado cuando un desarrolla-
dor mergea c ́odigo a la rama main:

Figura 4: Diagrama de secuencia

## Consideraciones t ́ecnicas para la implementaci ́on del

## Pipeline

- Sobre el Modelo de Miner ́ıa de Datos: Dado que entrenar un modelo desde
  cero est ́a fuera del alcance ́agil del desarrollo de la app, se debe utilizar un enfoque
  pragm ́atico: integrar una herramienta open-source basada en Machine Learning o
  un script custom que consuma una API de un modelo tipo CodeBERT fine-tuneado
  con datasets de CWEs (Common Weakness Enumerations ). El script debe leer los
  archivos .ts o .py modificados en el commit y retornar un c ́odigo de salida 0
  (seguro) o 1 (vulnerable).
- Limitaciones del PaaS Gratuito: Es importante documentar en el repositorio
  que servicios gratuitos como Render ”duermen”(sleep) tras 15 minutos de inactivi-
  dad. La primera petici ́on al microservicio maestro tras el reposo puede tardar ∼ 30
  segundos. Esto es aceptable para la fase de desarrollo del proyecto, pero el dise ̃no
  de los microservicios hijos debe contemplar mecanismos de Retry (reintentos) en
  sus llamadas al Master para no fallar si el Master est ́a despertando.
- Seguridad de Secretos: El token del Bot de Telegram, el token de SonarCloud y
  las credenciales de despliegue de Railway/Render deben estar estrictamente configu-
  rados en Settings ¿Secrets and variables ¿Actions en GitHub, aplicando el principio
  de m ́ınimo privilegio.s
