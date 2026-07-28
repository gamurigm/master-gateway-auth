import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PolicyService } from './policy.service';
import { POLICY_ACTION_KEY } from './policy.decorator';
import type { RequestWithUser } from '../auth/request-with-user';

/**
 * Consulta el motor de politicas (OPA) cuando esta configurado.
 *
 * Se aplica DESPUES de `PermissionsGuard`, de modo que OPA solo puede
 * restringir mas, nunca conceder lo que el RBAC local ya nego. Si `OPA_URL` no
 * esta definido el guard no interviene; si esta definido y OPA falla, deniega
 * (ver `PolicyService`).
 */
@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly policyService: PolicyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyMeta = this.reflector.getAllAndOverride<{
      action: string;
      resource: string;
    } | null>(POLICY_ACTION_KEY, [context.getHandler(), context.getClass()]);

    const action = policyMeta?.action ?? this.inferAction(context);
    const resource = policyMeta?.resource ?? '';

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    // Fail-closed: antes un request sin usuario devolvia `true` y se saltaba la
    // politica entera.
    if (!user) {
      throw new ForbiddenException('Usuario autenticado requerido');
    }

    const decision = await this.policyService.evaluate({
      subject: {
        user_id: user.sub,
        role_id: user.roleId,
        role_name: user.roleName,
        // Los permisos reales del token. Antes se enviaba `[]` siempre, con lo
        // que la politica rego no podia evaluar `has_permission` de forma util.
        permissions: user.permissions ?? [],
      },
      action,
      resource,
    });

    if (decision.engine === 'opa' && !decision.allow) {
      throw new ForbiddenException('Politica denego la operacion');
    }

    return true;
  }

  private inferAction(context: ExecutionContext): string {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const method = (request.method ?? 'get').toLowerCase();
    const routePath: string = request.url ?? '';
    const resource = routePath.replace(/^\/|\/$/g, '').replace(/\//g, ':');
    return `${resource}:${method}`;
  }
}
