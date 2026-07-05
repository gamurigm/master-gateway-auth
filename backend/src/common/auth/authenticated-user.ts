export interface AuthenticatedUser {
  sub: string;
  roleId: string;
  roleName?: string;
  jti?: string;
}

