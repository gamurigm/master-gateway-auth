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

    if (!user) {
      return true;
    }

    const result = await this.policyService.evaluate({
      subject: {
        user_id: user.sub,
        role_id: user.roleId,
        role_name: user.roleName,
        permissions: [],
      },
      action,
      resource,
    });

    if (!result.allow) {
      throw new ForbiddenException('Política denegó la operación');
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
