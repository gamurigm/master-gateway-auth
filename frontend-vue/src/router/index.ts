import { createRouter, createWebHistory } from 'vue-router'
import { authService } from '../services/auth.service'
import { useMenuStore } from '../stores/menu'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/login' },
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/select-role',
      name: 'SelectRole',
      component: () => import('../views/SelectRoleView.vue'),
    },
    {
      path: '/app',
      name: 'Shell',
      component: () => import('../views/ShellView.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'Dashboard', component: () => import('../views/DashboardView.vue') },
        { path: 'users', name: 'Users', component: () => import('../views/UserListView.vue') },
        { path: 'users/new', name: 'UserNew', component: () => import('../views/UserFormView.vue') },
        { path: 'users/:id', name: 'UserEdit', component: () => import('../views/UserFormView.vue') },
        { path: 'roles', name: 'Roles', component: () => import('../views/RoleListView.vue') },
        { path: 'roles/new', name: 'RoleNew', component: () => import('../views/RoleFormView.vue') },
        { path: 'roles/:id', name: 'RoleEdit', component: () => import('../views/RoleFormView.vue') },
        { path: 'roles/:id/detail', name: 'RoleDetail', component: () => import('../views/RoleDetailView.vue') },
        { path: 'modules', name: 'Modules', component: () => import('../views/ModuleListView.vue') },
        { path: 'modules/new', name: 'ModuleNew', component: () => import('../views/ModuleFormView.vue') },
        { path: 'modules/:id', name: 'ModuleEdit', component: () => import('../views/ModuleFormView.vue') },
        { path: 'menus', name: 'Menus', component: () => import('../views/MenuListView.vue') },
        { path: 'menus/new', name: 'MenuNew', component: () => import('../views/MenuFormView.vue') },
        { path: 'menus/:id', name: 'MenuEdit', component: () => import('../views/MenuFormView.vue') },
        { path: 'external-services', name: 'ExternalServices', component: () => import('../views/ExternalServiceListView.vue') },
        { path: 'external-services/new', name: 'ExternalServiceNew', component: () => import('../views/ExternalServiceFormView.vue') },
        { path: 'inventario', name: 'Inventory', component: () => import('../views/InventoryView.vue') },
      ],
    },
    { path: '/unauthorized', name: 'Unauthorized', component: () => import('../views/UnauthorizedView.vue') },
    { path: '/:pathMatch(.*)*', name: 'NotFound', component: () => import('../views/UnauthorizedView.vue') },
  ],
})

router.beforeEach(async (to, _from, next) => {
  const authed = authService.isAuthenticated()

  if (to.meta.requiresAuth && !authed) {
    return next('/login')
  }

  // Tras un refresh de página el router se reinicia y pierde las rutas
  // inyectadas dinámicamente, de modo que un menú de servicio externo caería a
  // NotFound. Si el usuario está autenticado y va a una ruta /app/* que aún no
  // resuelve, se recargan las rutas y se reintenta UNA vez.
  const unresolved = to.matched.length === 0 || to.name === 'NotFound'
  if (authed && unresolved && to.path.startsWith('/app/')) {
    if (!to.query.__retry) {
      const menuStore = useMenuStore()
      await menuStore.ensureRoutes(router)
      return next({ path: to.path, query: { ...to.query, __retry: '1' }, replace: true })
    }
    // Ya se reintentó y la ruta SIGUE sin resolver: se cae al dashboard en vez
    // de re-navegar a la misma ruta (eso provocaba un bucle infinito que colgaba
    // la app con cualquier /app/* sin ruta registrada).
    return next({ path: '/app', replace: true })
  }

  // Limpia el marcador de reintento para no dejarlo en la barra de direcciones.
  if (to.query.__retry) {
    const { __retry, ...rest } = to.query
    return next({ path: to.path, query: rest, replace: true })
  }

  next()
})

export default router
