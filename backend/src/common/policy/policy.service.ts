import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PolicyInput {
  subject: {
    user_id: string;
    role_id: string;
    role_name: string;
    permissions: string[];
  };
  action: string;
  resource: string;
  target?: Record<string, unknown>;
}

/**
 * Resultado de consultar el motor de politicas.
 *
 * `disabled` NO es lo mismo que `allow`. Distinguirlos es justo lo que faltaba:
 * antes las tres rutas de error (OPA sin configurar, OPA respondiendo != 200 y
 * OPA inalcanzable) devolvian `allow: true`, con el comentario "Permitiendo por
 * seguridad" — exactamente al reves de lo que exige Zero Trust. Cualquiera que
 * tumbara OPA, o simplemente un despliegue sin `OPA_URL`, desactivaba en
 * silencio todas las politicas.
 *
 * Ahora:
 *  - sin `OPA_URL` -> `disabled`: no hay motor externo, manda el RBAC local
 *    (`PermissionsGuard`), que siempre se aplica.
 *  - con `OPA_URL` y fallo de cualquier tipo -> `allow: false` (fail-closed).
 */
export type PolicyDecision =
  { engine: 'disabled' } | { engine: 'opa'; allow: boolean };

@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);
  private disabledWarningLogged = false;

  constructor(private readonly configService: ConfigService) {}

  async evaluate(input: PolicyInput): Promise<PolicyDecision> {
    const opaUrl = this.configService.get<string>('OPA_URL');

    if (!opaUrl) {
      // Se avisa una sola vez para no inundar el log en cada peticion.
      if (!this.disabledWarningLogged) {
        this.logger.warn(
          'OPA_URL no configurado: el motor de politicas externo esta desactivado. ' +
            'La autorizacion se resuelve con el RBAC local (roles + permisos del token).',
        );
        this.disabledWarningLogged = true;
      }
      return { engine: 'disabled' };
    }

    try {
      const response = await fetch(`${opaUrl}/v1/data/master_gateway/authz`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input }),
        signal: AbortSignal.timeout(2000),
      });

      if (!response.ok) {
        this.logger.error(
          `OPA respondio ${response.status}. Se DENIEGA la operacion (fail-closed).`,
        );
        return { engine: 'opa', allow: false };
      }

      const body = (await response.json()) as { result?: { allow?: boolean } };
      return { engine: 'opa', allow: body?.result?.allow === true };
    } catch (error) {
      this.logger.error(
        `OPA no disponible (${error instanceof Error ? error.message : 'desconocido'}). ` +
          'Se DENIEGA la operacion (fail-closed).',
      );
      return { engine: 'opa', allow: false };
    }
  }
}
