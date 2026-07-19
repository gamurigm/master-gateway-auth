import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestWithUser } from '../auth/request-with-user';
import { PolicyService } from './policy.service';
import { REQUIRED_PERMISSION_KEY } from './require-permission.decorator';

@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly policyService: PolicyService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const requiredPermission = this.reflector.getAllAndOverride<string>(
      REQUIRED_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      throw new UnauthorizedException('Token requerido');
    }

    await this.policyService.assertAllowed(request.user, requiredPermission);
    return true;
  }
}
