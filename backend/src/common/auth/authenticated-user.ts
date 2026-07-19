export interface AuthenticatedUser {
  sub: string;
  jti: string;
  sid: string;
  roleId: string;
  roleName: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
}