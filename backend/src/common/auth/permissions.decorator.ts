import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS_KEY = 'required_permissions';

/**
 * Declara los permisos que exige un endpoint (menor privilegio, §6.2).
 *
 * Complementa a `@RequireRoles`: el rol dice QUIEN entra al modulo, el permiso
 * dice QUE puede hacer dentro. Los permisos viajan en el access token, asi que
 * la comprobacion no toca la base de datos.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
