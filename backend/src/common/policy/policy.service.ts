import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Estado } from '@prisma/client';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { PrismaService } from '../../prisma/prisma.service';

type PolicyTarget = Record<string, unknown>;

type PolicyInput = {
  subject: {
    user_id: string;
    role_id: string;
    role_name: string;
    permissions: string[];
  };
  action: string;
  target: PolicyTarget;
};

@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);
  private readonly opaUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const configuredOpaUrl = (
      this.configService.get<string>('OPA_URL') ?? 'http://localhost:8181'
    ).replace(/\/$/, '');
    this.opaUrl = /^https?:\/\//i.test(configuredOpaUrl)
      ? configuredOpaUrl
      : `http://${configuredOpaUrl}`;
  }

  async assertAllowed(
    user: AuthenticatedUser,
    action: string,
    target: PolicyTarget = {},
  ) {
    const allowed = await this.isAllowed(user, action, target);
    if (!allowed) {
      throw new ForbiddenException('Permiso no autorizado');
    }
  }

  async isAllowed(
    user: AuthenticatedUser,
    action: string,
    target: PolicyTarget = {},
  ) {
    const input: PolicyInput = {
      subject: {
        user_id: user.sub,
        role_id: user.roleId,
        role_name: user.roleName,
        permissions: await this.getRolePermissionCodes(user.roleId),
      },
      action,
      target,
    };

    return this.evaluate(input);
  }

  async getRolePermissionCodes(roleId: string) {
    const assignments = await this.prisma.rolePermission.findMany({
      where: {
        roleId,
        estado: Estado.ACTIVO,
        role: { estado: Estado.ACTIVO },
        permission: { estado: Estado.ACTIVO },
      },
      include: { permission: true },
      orderBy: { permission: { code: 'asc' } },
    });

    return assignments.map((assignment) => assignment.permission.code);
  }

  private async evaluate(input: PolicyInput) {
    let response: Response;
    try {
      response = await fetch(`${this.opaUrl}/v1/data/master_gateway/authz/allow`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input }),
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'opa.evaluate.failed',
          reason: error instanceof Error ? error.message : 'unknown',
        }),
      );
      throw new ServiceUnavailableException('Motor de politicas no disponible');
    }

    if (!response.ok) {
      this.logger.error(
        JSON.stringify({
          event: 'opa.evaluate.failed',
          status: response.status,
          body: await response.text(),
        }),
      );
      throw new ServiceUnavailableException('Motor de politicas no disponible');
    }

    const result = (await response.json()) as { result?: boolean };
    return result.result === true;
  }
}
