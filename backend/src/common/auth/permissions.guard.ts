import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestWithUser } from './request-with-user';
import { REQUIRED_PERMISSIONS_KEY } from './permissions.decorator';

const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

/**
 * Aplica el menor privilegio (§6.2) en el servidor.
 *
 * Hasta ahora la autorizacion se resolvia SOLO por nombre de rol
 * (`@RequireRoles('ADMIN')`): las tablas `rol_permisos`, `rol_modulos` y
 * `rol_menus` existian pero no gobernaban ninguna decision del backend, solo
 * alimentaban el menu del frontend. Es decir, el modelo de permisos era
 * decorativo y cualquier usuario con el rol adecuado podia invocar cualquier
 * endpoint de ese rol.
 *
 * Este guard cierra esa brecha: los permisos del rol elegido viajan firmados
 * dentro del access token y aqui se exigen por endpoint, sin consultar la base
 * de datos (mantiene el diseno stateless del §7.2).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    // Fail-closed: sin identidad no se autoriza nada.
    if (!user) {
      throw new ForbiddenException('Usuario autenticado requerido');
    }

    if (user.roleName === SUPER_ADMIN_ROLE) {
      return true;
    }

    const granted = new Set(user.permissions ?? []);
    const missing = required.filter((permission) => !granted.has(permission));

    if (missing.length > 0) {
      throw new ForbiddenException(
        `El rol no tiene los permisos requeridos: ${missing.join(', ')}`,
      );
    }

    return true;
  }
}
