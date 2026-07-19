<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <AppIcon name="shield" size="24" />
      <div class="brand-text">
        <strong>Master Gateway</strong>
        <small v-if="authStore.currentRole">{{ authStore.currentRole.name }}</small>
      </div>
    </div>
    <nav class="sidebar-nav">
      <template v-if="navState === 'loading'">
        <div class="list-state"><div class="state-spinner" /> Cargando...</div>
      </template>
      <template v-else-if="navState === 'error'">
        <div class="error-state">
          <AppIcon name="alert-triangle" size="20" />
          <p>Error al cargar navegacion</p>
          <button class="secondary-button" @click="loadNavigation">Reintentar</button>
        </div>
      </template>
      <template v-else-if="navState === 'empty'">
        <div class="empty-state">
          <AppIcon name="menu" size="20" />
          <p>Sin menu disponible</p>
        </div>
      </template>
      <ul v-else class="nav-tree">
        <li v-for="mod in modules" :key="mod.id">
          <span class="module-group">
            <AppIcon v-if="getModuleIcon(mod)" :name="getModuleIcon(mod)" size="16" />
            <span>{{ mod.name }}</span>
          </span>
          <ul class="child-menu">
            <MenuItem v-for="menu in mod.menus" :key="menu.id" :node="menu" />
          </ul>
        </li>
      </ul>
    </nav>
    <div class="sidebar-footer">
      <button class="logout-button" @click="handleLogout">
        <AppIcon name="log-out" size="18" />
        Cerrar sesion
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { authService } from '../services/auth.service'
import { menuService } from '../services/menu.service'
import { useAuthStore } from '../stores/auth'
import type { MenuModule } from '../types'
import AppIcon from './AppIcon.vue'
import MenuItem from './MenuItem.vue'

const router = useRouter()
const authStore = useAuthStore()
const modules = ref<MenuModule[]>([])
const navState = ref<'loading' | 'error' | 'empty' | 'loaded'>('loading')

function getModuleIcon(mod: MenuModule): string {
  const first = mod.menus?.[0]
  return first?.icon || 'box'
}

async function loadNavigation() {
  navState.value = 'loading'
  try {
    const { data } = await menuService.tree()
    modules.value = data
    navState.value = data.length ? 'loaded' : 'empty'
  } catch {
    navState.value = 'error'
  }
}

async function handleLogout() {
  await authService.logout()
  authStore.clearSession()
  router.push('/login')
}

onMounted(loadNavigation)
</script>
