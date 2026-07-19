<template>
  <main class="auth-page">
    <div class="auth-panel">
      <div class="auth-header">
        <AppIcon name="users" size="40" />
        <h1>Seleccionar Rol</h1>
        <p>Elija el rol con el que desea trabajar</p>
      </div>
      <div v-if="roles.length" class="role-list">
        <button
          v-for="role in roles"
          :key="role.id"
          class="role-button"
          :disabled="selecting"
          @click="selectRole(role.id)"
        >
          <AppIcon name="user-check" size="20" />
          <span>{{ role.name }}</span>
        </button>
      </div>
      <p v-else class="error">No tiene roles asignados</p>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authService } from '../services/auth.service'
import { useAuthStore } from '../stores/auth'
import AppIcon from '../components/AppIcon.vue'

const router = useRouter()
const authStore = useAuthStore()
const roles = ref(authService.getRolesFromLogin())
const selecting = ref(false)

if (!authService.hasTempToken()) {
  router.replace('/login')
}

async function selectRole(roleId: string) {
  selecting.value = true
  try {
    const session = await authService.selectRole(roleId)
    authStore.setSession(session.role)
    router.push('/app')
  } catch {
    router.push('/login')
  }
}
</script>
