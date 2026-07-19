import api from './api'
import type { SystemModule, CreateModuleDto, UpdateModuleDto } from '../types'

export const modulesService = {
  findAll() {
    return api.get<SystemModule[]>('/modules')
  },
  findOne(id: string) {
    return api.get<SystemModule>(`/modules/${id}`)
  },
  create(dto: CreateModuleDto) {
    return api.post<SystemModule>('/modules', dto)
  },
  update(id: string, dto: UpdateModuleDto) {
    return api.put<SystemModule>(`/modules/${id}`, dto)
  },
  remove(id: string) {
    return api.delete<{ success: boolean }>(`/modules/${id}`)
  },
}
