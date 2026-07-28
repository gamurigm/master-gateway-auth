import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Router } from 'vue-router'
import { menuService } from '../services/menu.service'
import type { MenuModule, MenuNode, SystemModule, Menu } from '../types'
import { clearMenuRoutes, registerMenuRoutes, addDynamicRoute, removeDynamicRoute } from '../router/dynamic-routes'

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

  // ─────────── Mutaciones directas ───────────

  /** Agrega un módulo al árbol local (sin refetch). */
  function addModule(mod: SystemModule): void {
    const entry: MenuModule = {
      id: mod.id,
      code: mod.code,
      name: mod.name,
      menus: [],
    }
    modules.value.push(entry)
  }

  /** Actualiza propiedades de un módulo en el árbol local. */
  function updateModule(id: string, data: { code?: string; name?: string; description?: string }): void {
    const mod = modules.value.find((m) => m.id === id)
    if (!mod) return
    if (data.code !== undefined) mod.code = data.code
    if (data.name !== undefined) mod.name = data.name
  }

  /** Elimina un módulo del árbol local y limpia sus rutas dinámicas. */
  function removeModule(router: Router, id: string): void {
    const mod = modules.value.find((m) => m.id === id)
    if (!mod) return
    for (const menu of mod.menus) {
      removeNodeRoute(router, menu)
    }
    modules.value = modules.value.filter((m) => m.id !== id)
  }

  /** Convierte un Menu (respuesta del API) a MenuNode y lo inserta en el árbol. */
  function menuToNode(menu: Menu): MenuNode {
    return {
      id: menu.id,
      name: menu.name,
      url: menu.url ?? null,
      icon: menu.icon ?? null,
      order: menu.order,
      children: [],
    }
  }

  /** Agrega un menú al árbol local y registra su ruta si es interna. */
  function addMenu(router: Router, menu: Menu): void {
    const node = menuToNode(menu)

    if (menu.parentId) {
      const parent = findNodeById(modules.value, menu.parentId)
      if (parent) {
        parent.children.push(node)
        addDynamicRoute(router, node)
        return
      }
    }

    const mod = modules.value.find((m) => m.id === menu.moduleId)
    if (mod) {
      mod.menus.push(node)
      addDynamicRoute(router, node)
    }
  }

  /** Actualiza propiedades de un nodo menú en el árbol local y re-registra ruta si cambió la URL. */
  function updateMenu(id: string, data: Record<string, unknown>, router: Router): void {
    const node = findNodeById(modules.value, id)
    if (!node) return

    const oldUrl = node.url
    if (typeof data.name === 'string') node.name = data.name
    if (data.url !== undefined) node.url = data.url as string | null
    if (typeof data.icon === 'string') node.icon = data.icon
    if (typeof data.order === 'number') node.order = data.order

    if (node.url !== oldUrl) {
      removeDynamicRoute(oldUrl)
      addDynamicRoute(router, node)
    }
  }

  /** Elimina un menú del árbol local y limpia su ruta dinámica. */
  function removeMenu(router: Router, id: string): void {
    removeNodeById(modules.value, id, router)
  }

  // ─────────── Helpers privados ───────────

  function findNodeById(tree: MenuModule[], id: string): MenuNode | null {
    for (const mod of tree) {
      for (const menu of mod.menus) {
        const found = findNodeRecursive(menu, id)
        if (found) return found
      }
    }
    return null
  }

  function findNodeRecursive(node: MenuNode, id: string): MenuNode | null {
    if (node.id === id) return node
    for (const child of node.children) {
      const found = findNodeRecursive(child, id)
      if (found) return found
    }
    return null
  }

  function removeNodeById(tree: MenuModule[], id: string, router: Router): boolean {
    for (const mod of tree) {
      const idx = mod.menus.findIndex((m) => m.id === id)
      if (idx !== -1) {
        removeNodeRoute(router, mod.menus[idx])
        mod.menus.splice(idx, 1)
        return true
      }
      if (removeChildRecursive(mod.menus, id, router)) return true
    }
    return false
  }

  function removeChildRecursive(children: MenuNode[], id: string, router: Router): boolean {
    for (let i = 0; i < children.length; i++) {
      if (children[i].id === id) {
        removeNodeRoute(router, children[i])
        children.splice(i, 1)
        return true
      }
      if (removeChildRecursive(children[i].children, id, router)) return true
    }
    return false
  }

  function removeNodeRoute(router: Router, node: MenuNode): void {
    removeDynamicRoute(node.url)
    for (const child of node.children) {
      removeNodeRoute(router, child)
    }
  }

  function reset(): void {
    clearMenuRoutes()
    modules.value = []
    state.value = 'idle'
  }

  return {
    modules, state, load, ensureRoutes, reset,
    addModule, updateModule, removeModule,
    addMenu, updateMenu, removeMenu,
  }
})
