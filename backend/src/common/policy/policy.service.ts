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

export interface PolicyResult {
  allow: boolean;
  decision_id?: string;
}

@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);

  constructor(private readonly configService: ConfigService) {}

  async evaluate(input: PolicyInput): Promise<PolicyResult> {
    const opaUrl = this.configService.get<string>('OPA_URL');

    if (!opaUrl) {
      this.logger.warn(
        'OPA_URL no configurado. Política permitida por defecto.',
      );
      return { allow: true };
    }

    try {
      const response = await fetch(`${opaUrl}/v1/data/master_gateway/authz`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input }),
        signal: AbortSignal.timeout(2000),
      });

      if (!response.ok) {
        this.logger.warn(
          `OPA respondió ${response.status}. Permitiendo por seguridad.`,
        );
        return { allow: true };
      }

      const body = (await response.json()) as { result?: { allow?: boolean } };
      return { allow: body?.result?.allow === true };
    } catch (error) {
      this.logger.warn(
        `OPA no disponible (${error instanceof Error ? error.message : 'desconocido'}). Permitiendo por defecto.`,
      );
      return { allow: true };
    }
  }
}
