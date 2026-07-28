type EntityWithApiKey = {
  apiKey?: string | null;
  [key: string]: unknown;
};

/**
 * Quita la credencial de servicio antes de serializar un `ExternalService`.
 *
 * Mismo criterio que `omitPassword` para Usuario: la clave con la que el
 * Gateway se identifica ante un microservicio nunca debe viajar en una
 * respuesta HTTP. En su lugar se expone `hasApiKey`, que es lo unico que la UI
 * necesita para saber si el servicio ya tiene identidad configurada.
 */
export function omitApiKey<T extends EntityWithApiKey>(entity: T) {
  const { apiKey, ...safeEntity } = entity;

  return { ...safeEntity, hasApiKey: Boolean(apiKey) };
}
