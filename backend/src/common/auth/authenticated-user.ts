import type { TokenUse } from './gateway-token';

export interface AuthenticatedUser {
  sub: string;
  jti: string;
  roleId: string;
  roleName: string;
  /** Siempre `'access'` en peticiones autenticadas (lo exige `JwtAuthGuard`). */
  token_use: TokenUse;
  /** Permisos del rol elegido, embebidos en el token (menor privilegio, §6.2). */
  permissions: string[];
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}
