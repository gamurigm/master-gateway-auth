import { Injectable, Logger } from '@nestjs/common';

/**
 * Identidad de SERVICIO del Gateway frente a un microservicio (ADR-3).
 *
 * Zero Trust exige no confiar en la red: que una peticion llegue desde dentro
 * de la red de Docker no prueba que venga del Gateway. El proxy ya inyecta la
 * identidad del USUARIO (`x-gateway-user-id`, `x-gateway-role-*`), pero un
 * impostor en esa misma red podria fabricar esas cabeceras. La identidad de
 * servicio es lo que permite al microservicio distinguir al Gateway legitimo.
 *
 * Deliberadamente separado de `JwtAuthGuard`: son dos ejes independientes.
 * `JwtAuthGuard` responde "quien es el usuario"; esto responde "quien es el
 * llamante".
 *
 * La estrategia se elige con `ExternalService.authenticationType`, columna que
 * ya existia en el esquema. Anadir SERVICE_JWT o MTLS es una rama nueva en
 * `headersFor`, no un rediseno.
 */

/** Cabecera estandar de facto para credenciales de servicio. */
export const SERVICE_API_KEY_HEADER = 'x-api-key';

/** Identifica al emisor para que el micro pueda registrar/auditar el origen. */
export const SERVICE_IDENTITY_HEADER = 'x-gateway-service';

export interface ServiceIdentityInput {
  code: string;
  authenticationType: string | null;
  apiKey: string | null;
}

@Injectable()
export class ServiceIdentityService {
  private readonly logger = new Logger(ServiceIdentityService.name);
  /** Estrategias ya avisadas, para no repetir el log en cada peticion. */
  private readonly warnedStrategies = new Set<string>();

  /**
   * Cabeceras con las que el Gateway se identifica ante `service`.
   *
   * Devuelve un objeto vacio cuando no hay credencial que inyectar. Ese caso es
   * legitimo y frecuente: un servicio sin clave configurada sigue recibiendo
   * las cabeceras de identidad de usuario del proxy.
   */
  headersFor(service: ServiceIdentityInput): Record<string, string> {
    const strategy = (service.authenticationType ?? 'NONE').toUpperCase();

    switch (strategy) {
      case 'API_KEY':
        return this.apiKeyHeaders(service);

      // JWT es el valor por defecto de la columna y describe como el micro
      // valida al USUARIO, no al Gateway. No implica identidad de servicio,
      // pero si hay clave configurada se envia igualmente.
      case 'JWT':
      case 'NONE':
        return service.apiKey ? this.apiKeyHeaders(service) : {};

      case 'MTLS':
      case 'OIDC':
        // Pendientes. Se avisa una vez y se sigue sin credencial en vez de
        // fallar: el micro decidira si acepta la peticion.
        this.warnOnce(
          strategy,
          `El servicio ${service.code} declara ${strategy}, que aun no esta implementado. ` +
            'La peticion sale sin identidad de servicio.',
        );
        return {};

      default:
        this.warnOnce(
          strategy,
          `Estrategia de autenticacion desconocida (${strategy}) en ${service.code}.`,
        );
        return {};
    }
  }

  private apiKeyHeaders(service: ServiceIdentityInput): Record<string, string> {
    if (!service.apiKey) {
      this.warnOnce(
        `missing:${service.code}`,
        `El servicio ${service.code} declara API_KEY pero no tiene ninguna configurada.`,
      );
      return {};
    }

    return {
      [SERVICE_API_KEY_HEADER]: service.apiKey,
      [SERVICE_IDENTITY_HEADER]: 'master-gateway',
    };
  }

  private warnOnce(key: string, message: string) {
    if (this.warnedStrategies.has(key)) return;
    this.warnedStrategies.add(key);
    this.logger.warn(message);
  }
}
