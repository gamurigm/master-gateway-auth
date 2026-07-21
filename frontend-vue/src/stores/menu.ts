import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Router } from 'vue-router'
import { menuService } from '../services/menu.service'
import type { MenuModule } from '../types'
import { clearMenuRoutes, registerMenuRoutes } from '../router/dynamic-routes'

/**
 * Estado del árbol de menús del rol activo.
 *
 * Centraliza la carga (una sola vez por sesión) y el registro de rutas
 * dinámicas, en vez de que cada componente vuelva a pedir el árbol. El Sidebar y
 * el Dashboard consumen `modules` desde aquí.
 */
export const useMenuStore = defineStore('menu', () => {
  const modules = ref<MenuModule[]>([])
  const state = ref<'idle' | 'loading' | 'error' | 'empty' | 'loaded'>('idle')

  /**
   * Carga el árbol y registra sus rutas. `force` reobtiene aunque ya esté en
   * caché (tras crear un módulo, provisionar un servicio, etc.).
   */
  async function load(router: Router, force = false): Promise<void> {
    if (state.value === 'loaded' && !force) return

    state.value = 'loading'
    try {
      const { data } = await menuService.tree()
      modules.value = data
      // Limpia y vuelve a registrar: al cambiar de rol el árbol es distinto.
      clearMenuRoutes()
      registerMenuRoutes(router, data)
      state.value = data.length ? 'loaded' : 'empty'
    } catch {
      state.value = 'error'
    }
  }

  /**
   * Garantiza que las rutas dinámicas existan antes de resolver una navegación.
   * Necesario tras un refresh de página (F5), que reinicia el router y pierde
   * las rutas inyectadas; sin esto, la ruta caería al catch-all → /login.
   */
  async function ensureRoutes(router: Router): Promise<void> {
    if (state.value !== 'loaded') {
      await load(router)
    }
  }

  function reset(): void {
    clearMenuRoutes()
    modules.value = []
    state.value = 'idle'
  }

  return { modules, state, load, ensureRoutes, reset }
})
