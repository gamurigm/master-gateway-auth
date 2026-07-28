import { omitApiKey } from './omit-api-key';

describe('omitApiKey', () => {
  // La credencial con la que el Gateway se identifica ante un microservicio no
  // debe viajar NUNCA en una respuesta HTTP: `ExternalService` se serializa en
  // findAll, findOne, create y update.
  it('removes the api key and reports only its presence', () => {
    const result = omitApiKey({
      id: 'service-id',
      code: 'inventario',
      apiKey: 'clave-secreta',
    });

    expect(result).not.toHaveProperty('apiKey');
    expect(result).toMatchObject({ code: 'inventario', hasApiKey: true });
    expect(JSON.stringify(result)).not.toContain('clave-secreta');
  });

  it('reports hasApiKey false when there is no credential', () => {
    expect(omitApiKey({ id: 'service-id', apiKey: null })).toMatchObject({
      hasApiKey: false,
    });
    expect(omitApiKey({ id: 'service-id' })).toMatchObject({
      hasApiKey: false,
    });
  });

  it('does not mutate the source record', () => {
    const source = { id: 'service-id', apiKey: 'clave-secreta' };
    omitApiKey(source);

    expect(source.apiKey).toBe('clave-secreta');
  });
});
