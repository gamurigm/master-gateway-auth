import type { Router } from 'vue-router'
import type { MenuModule, MenuNode } from '../types'

/**
 * Inyección de rutas en tiempo de ejecución a partir del árbol de menús.
 *
 * El PDF (§5.4) prohíbe que el frontend tenga las rutas hardcodeadas: la
 * navegación completa debe construirse dinámicamente desde el JSON que devuelve
 * el Master tras la selección de rol. Aquí se recorre ese árbol y, por cada menú
 * hoja cuya `url` empiece por `/app/` y no exista ya como ruta estática, se
 * registra una ruta que renderiza `DynamicPageView`.
 *
 * Es idempotente y reversible: `clearMenuRoutes` deshace todo lo registrado, lo
 * que se usa al cerrar sesión y antes de recargar el menú de un rol distinto.
 */

const PARENT_ROUTE_NAME = 'Shell'
const DYNAMIC_ROUTE_PREFIX = 'dynamic:'

/** Guarda las funciones de desregistro que devuelve router.addRoute. */
const registered = new Map<string, () => void>()

function collectLeaves(node: MenuNode, acc: MenuNode[]): void {
  if (node.url && node.children.length === 0) {
    acc.push(node)
  }
  for (const child of node.children) {
    collectLeaves(child, acc)
  }
}

/**
 * Registra las rutas de todos los menús hoja internos que aún no existen.
 * Devuelve cuántas rutas nuevas se añadieron (útil para tests y logs).
 */
export function registerMenuRoutes(router: Router, tree: MenuModule[]): number {
  const leaves: MenuNode[] = []
  for (const mod of tree) {
    for (const menu of mod.menus) {
      collectLeaves(menu, leaves)
    }
  }

  let added = 0
  for (const leaf of leaves) {
    const url = leaf.url ?? ''
    // Sólo rutas internas de la SPA. Las URLs absolutas se abren en otra pestaña
    // desde el propio ítem de menú, no necesitan ruta.
    if (!url.startsWith('/app/')) continue

    const routeName = `${DYNAMIC_ROUTE_PREFIX}${url}`

    // Ya existe como ruta estática (users, roles, ...) o ya la registramos.
    if (router.hasRoute(routeName) || router.getRoutes().some((r) => r.path === url)) {
      continue
    }

    // El path se registra relativo al padre 'Shell', que vive en '/app'.
    const relativePath = url.replace(/^\/app\//, '')

    const remove = router.addRoute(PARENT_ROUTE_NAME, {
      path: relativePath,
      name: routeName,
      component: () => import('../views/DynamicPageView.vue'),
      meta: { requiresAuth: true, menu: leaf },
    })
    registered.set(routeName, remove)
    added += 1
  }

  return added
}

/** Elimina todas las rutas dinámicas registradas. */
export function clearMenuRoutes(): void {
  for (const remove of registered.values()) {
    remove()
  }
  registered.clear()
}

export function hasDynamicRoutes(): boolean {
  return registered.size > 0
}
