export interface RoleSummary {
  id: string
  name: string
  description?: string | null
}

export interface LoginResponse {
  tempToken: string
  roles: RoleSummary[]
  user: { id: string; email: string; firstName: string; lastName?: string | null }
}

export interface SessionResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: string
  role: RoleSummary
}

export interface MenuNode {
  id: string
  name: string
  url: string | null
  icon: string | null
  order: number
  children: MenuNode[]
}

export interface MenuModule {
  id: string
  code: string
  name: string
  menus: MenuNode[]
}

export interface User {
  id: string
  email: string
  firstName: string
  lastName?: string | null
  estado: string
  createdAt: string
  updatedAt: string
  roles?: { id: string; role: RoleSummary }[]
}

export interface CreateUserDto {
  email: string
  password: string
  firstName: string
  lastName?: string
}

export interface UpdateUserDto {
  email?: string
  password?: string
  firstName?: string
  lastName?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface RoleUserAssignment {
  id: string
  estado: string
  user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'estado'>
  role: RoleSummary
}

export interface RoleModuleAssignment {
  id: string
  estado: string
  module: SystemModule
}

export interface RoleMenuAssignment {
  id: string
  estado: string
  menu: Menu
}

export interface Permission {
  id: string
  code: string
  resource: string
  action: string
  description?: string
  delegable: boolean
  estado: string
  createdAt: string
  updatedAt: string
}

export interface RolePermissionAssignment {
  id: string
  estado: string
  permission: Permission
}

export interface Role {
  id: string
  name: string
  description?: string | null
  estado: string
  createdAt: string
  updatedAt: string
  users?: { id: string; role: RoleSummary }[]
  modules?: { id: string; module: SystemModule }[]
  menus?: { id: string; menu: Menu }[]
  permissions?: { id: string; permission: Permission }[]
}

export interface RoleDetail {
  id: string
  name: string
  description?: string | null
  estado: string
  createdAt: string
  updatedAt: string
  users: RoleUserAssignment[]
  modules: RoleModuleAssignment[]
  menus: RoleMenuAssignment[]
  permissions: RolePermissionAssignment[]
}

export interface CreateRoleDto {
  name: string
  description?: string
  permissionIds?: string[]
}

export interface UpdateRoleDto {
  name?: string
  description?: string
}

export interface SystemModule {
  id: string
  code: string
  name: string
  description?: string | null
  estado: string
  createdAt: string
  updatedAt: string
  menus?: Menu[]
}

export interface CreateModuleDto {
  code: string
  name: string
  description?: string
}

export interface UpdateModuleDto {
  code?: string
  name?: string
  description?: string
}

export interface Menu {
  id: string
  name: string
  url?: string | null
  icon?: string | null
  order: number
  moduleId: string
  parentId?: string | null
  estado: string
  createdAt: string
  updatedAt: string
  module?: SystemModule
  parent?: Menu
}

export interface CreateMenuDto {
  name: string
  url?: string
  icon?: string
  order?: number
  moduleId: string
  parentId?: string
}

export interface UpdateMenuDto {
  name?: string
  url?: string
  icon?: string
  order?: number
  moduleId?: string
  parentId?: string
}

export interface ExternalService {
  id: string
  code: string
  name: string
  description?: string | null
  baseUrl: string
  healthPath: string
  openApiPath?: string | null
  lastProbeAt?: string | null
  lastProbeOk?: boolean | null
  lastProbeMs?: number | null
  moduleId?: string | null
  estado: string
  createdAt: string
  updatedAt: string
  module?: SystemModule | null
}

export interface DiscoveredEndpoint {
  name: string
  path: string
  method: string
}

export interface ProbeResult {
  reachable: boolean
  statusCode: number | null
  latencyMs: number
  resolvedAddress: string
  error: string | null
  discoveredEndpoints: DiscoveredEndpoint[]
}

export interface ProbeServiceDto {
  baseUrl: string
  healthPath?: string
  openApiPath?: string
}

export interface CreateExternalServiceDto {
  code: string
  name: string
  description?: string
  baseUrl: string
  healthPath?: string
  openApiPath?: string
}

export interface ProvisionMenuItem {
  name: string
  path: string
  icon?: string
}

export interface ProvisionServiceDto {
  roleIds: string[]
  items: ProvisionMenuItem[]
}

export interface InventoryProduct {
  sku: string
  name: string
  stock: number
  status: string
}

export interface InventoryResponse {
  context: { userId?: string; roleId?: string; roleName?: string }
  items: InventoryProduct[]
}
