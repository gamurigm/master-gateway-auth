export interface AuthenticatedUser {
  sub: string;
  jti: string;
  roleId: string;
  roleName: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}
