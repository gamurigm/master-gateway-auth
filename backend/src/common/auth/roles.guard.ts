import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestWithUser } from './request-with-user';
import { REQUIRED_ROLES_KEY } from './roles.decorator';

const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const roleName = request.user?.roleName;

    if (roleName === SUPER_ADMIN_ROLE) {
      return true;
    }

    if (roleName && requiredRoles.includes(roleName)) {
      return true;
    }

    throw new ForbiddenException('Rol no autorizado');
  }
}
