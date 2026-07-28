# ADR 0002 - Plataforma de integracion: Modulo -> Menu -> Item -> Microservicio

## Contexto

Integrar un microservicio nuevo exigia dos flujos distintos: registrar el
servicio en External Services y, aparte, crear los menus. El usuario tenia que
entender la relacion entre ambos para que el proxy funcionase.

El eje de la arquitectura es que **dar de alta un item de menu con su URL
destino es todo lo que hace falta** para que el Gateway enrute a un
microservicio, y que la validacion se haga desde el navegador: sin curl, sin
Postman, sin abrir el puerto del micro.

## Decisiones

### ADR-1: un menu con `targetUrl` crea su `ExternalService` sin intervencion

Al guardar un menu con `targetUrl`, el backend crea en la misma transaccion un
`ExternalService` oculto (prefijo `_route_`) y su `ExternalServiceRoute`.

- **Alternativa descartada:** obligar a registrar el servicio primero. Duplica
  esfuerzo y obliga a entender dos modelos para una sola tarea.
- **Consecuencia:** los servicios implicitos son detectables en base de datos,
  asi que un menu puede "promoverse" a servicio completo mas adelante. Se
  ocultan del listado de External Services filtrando por prefijo con
  `startsWith` de Prisma, no con `LIKE '_route_%'` (en SQL el guion bajo es un
  comodin de un caracter y ese patron casaria de mas).

### ADR-2: el proxy inyecta identidad de usuario, no reenvia el JWT

`ServiceProxyService` descarta `Authorization` en la peticion saliente y anade
`x-gateway-user-id`, `x-gateway-role-id`, `x-gateway-role-name` y
`x-gateway-permissions`.

- **Razon:** el micro no necesita el JWT, solo saber quien es el usuario. Evita
  que tenga que validar tokens y reduce la superficie de fuga.
- **Consecuencia critica:** si el micro confia en esas cabeceras, el Gateway
  debe garantizar que **solo el** las emite. Por eso estan en
  `BLOCKED_REQUEST_HEADERS`: si el cliente las manda, se descartan antes de
  reenviar. Sin esa lista, cualquier usuario autenticado podria suplantar a
  otro simplemente anadiendo una cabecera.

### ADR-3: la identidad de servicio es independiente de la de usuario

`ServiceIdentityService` esta separado de `JwtAuthGuard`. Responden a preguntas
distintas: el guard dice *quien es el usuario*; el servicio de identidad dice
*quien es el llamante*.

- **Razon:** Zero Trust exige no confiar en la red. Que una peticion venga de
  dentro de la red de Docker no prueba que venga del Gateway.
- **Implementacion:** la estrategia se elige con la columna
  `ExternalService.authenticationType`, que ya existia (`JWT`, `API_KEY`,
  `MTLS`, `OIDC`, `NONE`). Hoy solo `API_KEY` esta implementada; `MTLS` y
  `OIDC` avisan una vez y salen sin credencial. Anadirlas es una rama nueva en
  `headersFor`, no un rediseno.
- **La credencial nunca sale por la API.** Se filtra con `omitApiKey` en todas
  las lecturas, igual que `passwordHash` en Usuario, y se expone solo
  `hasApiKey`. Se genera (32 bytes aleatorios), no la elige el usuario, y se
  muestra una unica vez al rotarla.
- **Sin clave configurada no se inyecta nada.** El micro sigue recibiendo la
  identidad de usuario; es un caso legitimo, no un error.

`INTERNAL_API_KEY` es otra cosa: es la clave compartida con la que los hijos
llaman al Master (`/api/internals/validate-token`). La direccion es la inversa.

### ADR-4: no se exige `/internals/validate-token` a los servicios externos

Los micros nativos pueden implementarlo (validacion directa, opcion legacy).
Los nuevos y los externos usan el proxy con cabeceras de identidad.

- **Razon:** un micro de terceros (SAP, Stripe) jamas va a implementar un
  endpoint propietario del Gateway. El contrato minimo se queda en `GET /health`
  y, opcionalmente, `GET /internal/metadata`.

## Como se valida una integracion

Sin herramientas tecnicas, desde la UI:

1. Modulos -> crear el modulo.
2. Menus -> crear el menu raiz (sin URL) y el item hoja con
   `url = /app/<servicio>/<recurso>` y `targetUrl = http://<host>:<puerto>/<ruta>`.
3. Roles -> asignar el menu al rol.
4. Reingresar con ese rol y pulsar el menu.

Checklist: aparece en el sidebar, `DynamicPageView` muestra la respuesta del
micro, los errores HTTP se traducen (401/403/404/500) y el menu raiz agrupa los
hijos.

## Estado

| Pieza | Estado |
|---|---|
| Menu con `targetUrl` -> ruta de proxy (ADR-1) | Implementado |
| Cabeceras de identidad de usuario (ADR-2) | Implementado |
| API Key por servicio + `ServiceIdentityService` (ADR-3) | Implementado |
| Contrato minimo `/health` (ADR-4) | Implementado |
| JWKS `/.well-known/jwks.json` | Implementado |
| Deteccion automatica de `services/*` en CI | Implementado |
| `GET /internal/metadata` en `ventas` | Pendiente |
| Service JWT | Pendiente |
| mTLS | Pendiente (arquitectura preparada) |
