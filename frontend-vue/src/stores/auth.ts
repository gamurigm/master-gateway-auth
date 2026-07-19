import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authService } from '../services/auth.service'
import type { RoleSummary } from '../types'

export const useAuthStore = defineStore('auth', () => {
  const currentRole = ref<RoleSummary | null>(authService.getCurrentRole())
  const isAuthenticated = ref(authService.isAuthenticated())

  function setSession(role: RoleSummary) {
    currentRole.value = role
    isAuthenticated.value = true
  }

  function clearSession() {
    authService.clearSession()
    currentRole.value = null
    isAuthenticated.value = false
  }

  return { currentRole, isAuthenticated, setSession, clearSession }
})
