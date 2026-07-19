import api from './api'
import type { Permission } from '../types'

export const permissionsService = {
  findAll() {
    return api.get<Permission[]>('/permissions')
  },
}
