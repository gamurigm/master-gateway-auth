import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authService } from '../services/auth.service'
import type { AuthUserSummary, RoleSummary } from '../types'

export const useAuthStore = defineStore('auth', () => {
  const currentRole = ref<RoleSummary | null>(authService.getCurrentRole())
  const currentUser = ref<AuthUserSummary | null>(authService.getCurrentUser())
  const isAuthenticated = ref(authService.isAuthenticated())

  function setSession(role: RoleSummary) {
    currentRole.value = role
    currentUser.value = authService.getCurrentUser()
    isAuthenticated.value = true
  }

  function clearSession() {
    authService.clearSession()
    currentRole.value = null
    currentUser.value = null
    isAuthenticated.value = false
  }

  return { currentRole, currentUser, isAuthenticated, setSession, clearSession }
})