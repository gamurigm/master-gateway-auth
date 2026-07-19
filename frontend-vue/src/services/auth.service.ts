import api from './api'
import type { LoginResponse, SessionResponse } from '../types'

export const authService = {
  async login(email: string, password: string) {
    const { data } = await api.post<LoginResponse>('/auth/login', { email, password })
    sessionStorage.setItem('tempToken', data.tempToken)
    sessionStorage.setItem('roles', JSON.stringify(data.roles))
    sessionStorage.setItem('loginUser', JSON.stringify(data.user))
    return data
  },

  async selectRole(roleId: string) {
    const tempToken = sessionStorage.getItem('tempToken')
    const { data } = await api.post<SessionResponse>('/auth/select-role', { tempToken, roleId })
    localStorage.setItem('accessToken', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    localStorage.setItem('currentRole', JSON.stringify(data.role))
    sessionStorage.removeItem('tempToken')
    sessionStorage.removeItem('roles')
    return data
  },

  async refreshSession() {
    const refreshToken = localStorage.getItem('refreshToken')
    const { data } = await api.post<SessionResponse>('/auth/refresh-token', { refreshToken })
    localStorage.setItem('accessToken', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    return data
  },

  async logout() {
    const refreshToken = localStorage.getItem('refreshToken')
    try {
      await api.post('/auth/logout', { refreshToken })
    } catch {
    } finally {
      this.clearSession()
    }
  },

  clearSession() {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('currentRole')
    sessionStorage.removeItem('tempToken')
    sessionStorage.removeItem('roles')
    sessionStorage.removeItem('loginUser')
  },

  getAccessToken() {
    return localStorage.getItem('accessToken')
  },

  getRolesFromLogin() {
    const raw = sessionStorage.getItem('roles')
    return raw ? JSON.parse(raw) : []
  },

  getCurrentRole() {
    const raw = localStorage.getItem('currentRole')
    return raw ? JSON.parse(raw) : null
  },

  hasTempToken() {
    return !!sessionStorage.getItem('tempToken')
  },

  isAuthenticated() {
    return !!this.getAccessToken()
  },
}
