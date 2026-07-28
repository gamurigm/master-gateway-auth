<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <AppIcon
        name="shield"
        size="24"
      />
      <div class="brand-text">
        <strong>Master Gateway</strong>
        <small v-if="authStore.currentUser">{{ authStore.currentUser.email }}</small>
      </div>
    </div>
    <nav class="sidebar-nav">
      <template v-if="navState === 'loading' || navState === 'idle'">
        <div class="list-state">
          <div class="state-spinner" /> Cargando...
        </div>
      </template>
      <template v-else-if="navState === 'error'">
        <div class="error-state">
          <AppIcon
            name="alert-triangle"
            size="20"
          />
          <p>Error al cargar navegacion</p>
          <button
            class="secondary-button"
            @click="reload"
          >
            Reintentar
          </button>
        </div>
      </template>
      <template v-else-if="navState === 'empty'">
        <div class="empty-state">
          <AppIcon
            name="menu"
            size="20"
          />
          <p>Sin menu disponible</p>
        </div>
      </template>
      <ul
        v-else
        class="nav-tree"
      >
        <li
          v-for="mod in menuStore.modules"
          :key="mod.id"
        >
          <span class="module-group">
            <AppIcon
              v-if="getModuleIcon(mod)"
              :name="getModuleIcon(mod)"
              size="16"
            />
            <span>{{ mod.name }}</span>
          </span>
          <ul class="child-menu">
            <MenuItem
              v-for="menu in mod.menus"
              :key="menu.id"
              :node="menu"
            />
          </ul>
        </li>
      </ul>
    </nav>
    <div
      v-if="authStore.currentRole"
      class="session-card"
    >
      <span>Rol activo</span>
      <strong>{{ authStore.currentRole.name }}</strong>
    </div>
    <div class="sidebar-footer">
      <button
        class="logout-button"
        @click="handleLogout"
      >
        <AppIcon
          name="log-out"
          size="18"
        />
        Cerrar sesion
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { authService } from '../services/auth.service'
import { useAuthStore } from '../stores/auth'
import { useMenuStore } from '../stores/menu'
import type { MenuModule } from '../types'
import AppIcon from './AppIcon.vue'
import MenuItem from './MenuItem.vue'

const router = useRouter()
const authStore = useAuthStore()
const menuStore = useMenuStore()

// El estado de navegación se deriva del store: la carga y el registro de rutas
// dinámicas viven allí, no en el componente.
const navState = computed(() => menuStore.state)

function getModuleIcon(mod: MenuModule): string {
  const first = mod.menus?.[0]
  return first?.icon || 'box'
}

function reload() {
  return menuStore.load(router, true)
}

async function handleLogout() {
  await authService.logout()
  menuStore.reset()
  authStore.clearSession()
  router.push('/login')
}

onMounted(() => menuStore.load(router))
</script>
