export interface RoleSummary {
  id: string;
  name: string;
  description?: string | null;
}

export interface LoginResponse {
  tempToken: string;
  roles: RoleSummary[];
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName?: string | null;
  };
}

export interface SessionResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: string;
  role: RoleSummary;
}

export interface MenuNode {
  id: string;
  name: string;
  url: string | null;
  icon: string | null;
  order: number;
  children: MenuNode[];
}

export interface MenuModule {
  id: string;
  code: string;
  name: string;
  menus: MenuNode[];
}

