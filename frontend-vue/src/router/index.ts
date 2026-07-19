import { createRouter, createWebHistory } from 'vue-router'
import { authService } from '../services/auth.service'

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
        { path: 'inventario', name: 'Inventory', component: () => import('../views/InventoryView.vue') },
      ],
    },
    { path: '/unauthorized', name: 'Unauthorized', component: () => import('../views/UnauthorizedView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/login' },
  ],
})

router.beforeEach((to, _from, next) => {
  if (to.meta.requiresAuth && !authService.isAuthenticated()) {
    return next('/login')
  }
  next()
})

export default router
