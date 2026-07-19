import api from './api'
import type { Menu, MenuModule, CreateMenuDto, UpdateMenuDto } from '../types'

export const menuService = {
  tree() {
    return api.get<MenuModule[]>('/menus/tree')
  },
  findAll() {
    return api.get<Menu[]>('/menus')
  },
  findOne(id: string) {
    return api.get<Menu>(`/menus/${id}`)
  },
  create(dto: CreateMenuDto) {
    return api.post<Menu>('/menus', dto)
  },
  update(id: string, dto: UpdateMenuDto) {
    return api.put<Menu>(`/menus/${id}`, dto)
  },
  remove(id: string) {
    return api.delete<{ success: boolean }>(`/menus/${id}`)
  },
}
