import api from './api'
import type { User, CreateUserDto, UpdateUserDto, PaginatedResponse } from '../types'

export const usersService = {
  findAll(page = 1, limit = 10) {
    return api.get<PaginatedResponse<User>>('/users', { params: { page, limit } })
  },
  findOne(id: string) {
    return api.get<User>(`/users/${id}`)
  },
  create(dto: CreateUserDto) {
    return api.post<User>('/users', dto)
  },
  update(id: string, dto: UpdateUserDto) {
    return api.put<User>(`/users/${id}`, dto)
  },
  remove(id: string) {
    return api.delete<{ success: boolean }>(`/users/${id}`)
  },
}
