/** Metodos HTTP que puede exponer una ruta de proxy. */
export const PROXY_HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
] as const;

/**
 * Prefijo de los `ExternalService` creados implicitamente al dar de alta un
 * menu con `targetUrl`.
 *
 * Sirve para distinguirlos de los servicios registrados a mano desde el modulo
 * External Services y ocultarlos de ese listado. El filtrado se hace con
 * `startsWith` de Prisma, NO con `LIKE '_route_%'`: en SQL el guion bajo es un
 * comodin de un caracter, asi que ese patron casaria tambien con `Xroute_...`.
 */
export const IMPLICIT_ROUTE_SERVICE_PREFIX = '_route_';
