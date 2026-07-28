import {
  SERVICE_API_KEY_HEADER,
  SERVICE_IDENTITY_HEADER,
  ServiceIdentityService,
} from './service-identity.service';

describe('ServiceIdentityService', () => {
  let service: ServiceIdentityService;

  beforeEach(() => {
    service = new ServiceIdentityService();
  });

  it('injects the api key when the service declares API_KEY', () => {
    expect(
      service.headersFor({
        code: 'inventario',
        authenticationType: 'API_KEY',
        apiKey: 'clave-secreta',
      }),
    ).toEqual({
      [SERVICE_API_KEY_HEADER]: 'clave-secreta',
      [SERVICE_IDENTITY_HEADER]: 'master-gateway',
    });
  });

  // Requisito explicito: "Si el micro no tiene API Key configurada -> no
  // inyectar". El proxy sigue enviando las cabeceras de identidad de usuario.
  it('injects nothing when the service has no api key', () => {
    expect(
      service.headersFor({
        code: 'inventario',
        authenticationType: 'API_KEY',
        apiKey: null,
      }),
    ).toEqual({});
  });

  it('injects nothing for a service that declares no authentication', () => {
    expect(
      service.headersFor({
        code: 'legacy',
        authenticationType: 'NONE',
        apiKey: null,
      }),
    ).toEqual({});
  });

  it('still sends a configured key when the type is the JWT default', () => {
    // `JWT` es el valor por defecto de la columna y describe como el micro
    // valida al USUARIO; no deberia impedir enviar la identidad de servicio.
    expect(
      service.headersFor({
        code: 'ventas',
        authenticationType: 'JWT',
        apiKey: 'clave-secreta',
      }),
    ).toMatchObject({ [SERVICE_API_KEY_HEADER]: 'clave-secreta' });
  });

  it.each(['MTLS', 'OIDC'])(
    'injects nothing for the not-yet-implemented %s strategy',
    (strategy) => {
      expect(
        service.headersFor({
          code: 'externo',
          authenticationType: strategy,
          apiKey: 'ignorada',
        }),
      ).toEqual({});
    },
  );

  it('injects nothing for an unknown strategy', () => {
    expect(
      service.headersFor({
        code: 'raro',
        authenticationType: 'KERBEROS',
        apiKey: 'ignorada',
      }),
    ).toEqual({});
  });

  it('accepts the strategy in any case', () => {
    expect(
      service.headersFor({
        code: 'inventario',
        authenticationType: 'api_key',
        apiKey: 'clave-secreta',
      }),
    ).toMatchObject({ [SERVICE_API_KEY_HEADER]: 'clave-secreta' });
  });
});
