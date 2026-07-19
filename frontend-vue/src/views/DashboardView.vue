<template>
  <div class="admin-page">
    <div class="admin-header">
      <span class="eyebrow">Panel principal</span>
      <h1>Inicio</h1>
    </div>
    <div class="hero-section" v-if="authStore.currentRole">
      <AppIcon name="shield" size="28" />
      <div>
        <p class="hero-label">Rol activo</p>
        <p class="hero-value">{{ authStore.currentRole.name }}</p>
      </div>
    </div>
    <template v-if="state === 'loading'">
      <div class="list-state"><div class="state-spinner" /> Cargando...</div>
    </template>
    <template v-else-if="state === 'error'">
      <div class="error-state">
        <AppIcon name="alert-triangle" size="24" />
        <p>Error al cargar atajos</p>
        <button class="secondary-button" @click="loadShortcuts">Reintentar</button>
      </div>
    </template>
    <template v-else-if="state === 'empty'">
      <div class="empty-state">
        <AppIcon name="layout-dashboard" size="24" />
        <p>No hay accesos directos disponibles</p>
      </div>
    </template>
    <div v-else class="quick-grid">
      <template v-for="item in shortcuts" :key="item.id">
        <router-link v-if="item.url?.startsWith('/app/')" :to="item.url" class="quick-card">
          <span class="quick-icon">{{ item.icon?.[0] || item.name[0] }}</span>
          <span class="quick-module">{{ item._module }}</span>
          <span class="quick-name">{{ item.name }}</span>
        </router-link>
        <a v-else-if="item.url" :href="item.url" target="_blank" rel="noopener noreferrer" class="quick-card">
          <span class="quick-icon">{{ item.icon?.[0] || item.name[0] }}</span>
          <span class="quick-module">{{ item._module }}</span>
          <span class="quick-name">{{ item.name }}</span>
        </a>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { menuService } from '../services/menu.service'
import { useAuthStore } from '../stores/auth'
import type { MenuModule, MenuNode } from '../types'
import AppIcon from '../components/AppIcon.vue'

const authStore = useAuthStore()
const shortcuts = ref<(MenuNode & { _module: string })[]>([])
const state = ref<'loading' | 'error' | 'empty' | 'loaded'>('loading')

interface FlatItem extends MenuNode {
  _module: string
}

function flatten(tree: MenuModule[]): FlatItem[] {
  const result: FlatItem[] = []
  for (const mod of tree) {
    for (const menu of mod.menus) {
      collect(menu, mod.name, result)
    }
  }
  return result
}

function collect(node: MenuNode, moduleName: string, acc: FlatItem[]) {
  if (node.url) {
    acc.push({ ...node, _module: moduleName })
  }
  for (const child of node.children) {
    collect(child, moduleName, acc)
  }
}

async function loadShortcuts() {
  state.value = 'loading'
  try {
    const { data } = await menuService.tree()
    shortcuts.value = flatten(data)
    state.value = shortcuts.value.length ? 'loaded' : 'empty'
  } catch {
    state.value = 'error'
  }
}

onMounted(loadShortcuts)
</script>
