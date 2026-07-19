import api from './api'
import type { Role, RoleDetail, CreateRoleDto, UpdateRoleDto } from '../types'

export const rolesService = {
  findAll() {
    return api.get<Role[]>('/roles')
  },
  findOne(id: string) {
    return api.get<RoleDetail>(`/roles/${id}`)
  },
  create(dto: CreateRoleDto) {
    return api.post<Role>('/roles', dto)
  },
  update(id: string, dto: UpdateRoleDto) {
    return api.put<Role>(`/roles/${id}`, dto)
  },
  remove(id: string) {
    return api.delete<{ success: boolean }>(`/roles/${id}`)
  },
  assignUser(roleId: string, userId: string) {
    return api.post(`/roles/${roleId}/users`, { userId })
  },
  unassignUser(roleId: string, userId: string) {
    return api.delete(`/roles/${roleId}/users/${userId}`)
  },
  assignModule(roleId: string, moduleId: string) {
    return api.post(`/roles/${roleId}/modules`, { moduleId })
  },
  unassignModule(roleId: string, moduleId: string) {
    return api.delete(`/roles/${roleId}/modules/${moduleId}`)
  },
  assignMenu(roleId: string, menuId: string) {
    return api.post(`/roles/${roleId}/menus`, { menuId })
  },
  unassignMenu(roleId: string, menuId: string) {
    return api.delete(`/roles/${roleId}/menus/${menuId}`)
  },
  assignPermission(roleId: string, permissionId: string) {
    return api.post(`/roles/${roleId}/permissions`, { permissionId })
  },
  unassignPermission(roleId: string, permissionId: string) {
    return api.delete(`/roles/${roleId}/permissions/${permissionId}`)
  },
}
