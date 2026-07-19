<template>
  <div class="admin-page" v-if="role">
    <div class="admin-header">
      <span class="eyebrow">Permisos</span>
      <h1>{{ role.name }}</h1>
      <router-link to="/app/roles" class="secondary-button">Volver</router-link>
    </div>
    <div class="tab-bar">
      <button v-for="tab in tabs" :key="tab.key" class="tab" :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">
        {{ tab.label }} ({{ tab.count }})
      </button>
    </div>
    <div class="admin-card">
      <template v-if="activeTab === 'users'">
        <div class="assign-row"><select v-model="selectedUserId"><option value="">Seleccionar usuario...</option><option v-for="u in allUsers" :key="u.id" :value="u.id">{{ u.email }}</option></select><button class="primary-button" @click="assignUser">Asignar</button></div>
        <table class="crud-table"><thead><tr><th>Email</th><th>Nombres</th><th>Estado</th><th></th></tr></thead><tbody>
          <tr v-for="a in role.users" :key="a.id"><td>{{ a.user.email }}</td><td>{{ a.user.firstName }}</td><td><span class="badge" :class="a.user.estado === 'ACTIVO' ? 'badge-active' : 'badge-inactive'">{{ a.user.estado }}</span></td><td><button class="icon-btn delete" @click="unassign('user', a.user.id)"><AppIcon name="trash-2" size="16" /></button></td></tr>
        </tbody></table>
      </template>
      <template v-if="activeTab === 'modules'">
        <div class="assign-row"><select v-model="selectedModuleId"><option value="">Seleccionar modulo...</option><option v-for="m in allModules" :key="m.id" :value="m.id">{{ m.name }}</option></select><button class="primary-button" @click="assignModule">Asignar</button></div>
        <table class="crud-table"><thead><tr><th>Codigo</th><th>Nombre</th><th>Estado</th><th></th></tr></thead><tbody>
          <tr v-for="a in role.modules" :key="a.id"><td><code>{{ a.module.code }}</code></td><td>{{ a.module.name }}</td><td><span class="badge" :class="a.module.estado === 'ACTIVO' ? 'badge-active' : 'badge-inactive'">{{ a.module.estado }}</span></td><td><button class="icon-btn delete" @click="unassign('module', a.module.id)"><AppIcon name="trash-2" size="16" /></button></td></tr>
        </tbody></table>
      </template>
      <template v-if="activeTab === 'menus'">
        <div class="assign-row"><select v-model="selectedMenuId"><option value="">Seleccionar menu...</option><option v-for="m in allMenus" :key="m.id" :value="m.id">{{ m.name }}</option></select><button class="primary-button" @click="assignMenu">Asignar</button></div>
        <table class="crud-table"><thead><tr><th>Nombre</th><th>URL</th><th>Estado</th><th></th></tr></thead><tbody>
          <tr v-for="a in role.menus" :key="a.id"><td>{{ a.menu.name }}</td><td><code>{{ a.menu.url }}</code></td><td><span class="badge" :class="a.menu.estado === 'ACTIVO' ? 'badge-active' : 'badge-inactive'">{{ a.menu.estado }}</span></td><td><button class="icon-btn delete" @click="unassign('menu', a.menu.id)"><AppIcon name="trash-2" size="16" /></button></td></tr>
        </tbody></table>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { rolesService } from '../services/roles.service'
import { usersService } from '../services/users.service'
import { modulesService } from '../services/modules.service'
import { menuService } from '../services/menu.service'
import type { RoleDetail, User, SystemModule, Menu } from '../types'
import AppIcon from '../components/AppIcon.vue'

const route = useRoute()
const role = ref<RoleDetail | null>(null)
const allUsers = ref<User[]>([])
const allModules = ref<SystemModule[]>([])
const allMenus = ref<Menu[]>([])
const selectedUserId = ref('')
const selectedModuleId = ref('')
const selectedMenuId = ref('')
const activeTab = ref('users')

const tabs = computed(() => [
  { key: 'users', label: 'Usuarios', count: role.value?.users.length || 0 },
  { key: 'modules', label: 'Modulos', count: role.value?.modules.length || 0 },
  { key: 'menus', label: 'Menus', count: role.value?.menus.length || 0 },
])

async function loadRole() {
  const { data } = await rolesService.findOne(route.params.id as string)
  role.value = data
}

async function loadAll() {
  const [usersRes, modulesRes, menusRes] = await Promise.all([
    usersService.findAll(1, 999),
    modulesService.findAll(),
    menuService.findAll(),
  ])
  allUsers.value = usersRes.data.items
  allModules.value = modulesRes.data
  allMenus.value = menusRes.data
}

async function assignUser() {
  if (!selectedUserId.value || !role.value) return
  await rolesService.assignUser(role.value.id, selectedUserId.value)
  selectedUserId.value = ''
  await loadRole()
}

async function assignModule() {
  if (!selectedModuleId.value || !role.value) return
  await rolesService.assignModule(role.value.id, selectedModuleId.value)
  selectedModuleId.value = ''
  await loadRole()
}

async function assignMenu() {
  if (!selectedMenuId.value || !role.value) return
  await rolesService.assignMenu(role.value.id, selectedMenuId.value)
  selectedMenuId.value = ''
  await loadRole()
}

async function unassign(type: 'user' | 'module' | 'menu', id: string) {
  if (!role.value) return
  if (type === 'user') await rolesService.unassignUser(role.value.id, id)
  else if (type === 'module') await rolesService.unassignModule(role.value.id, id)
  else await rolesService.unassignMenu(role.value.id, id)
  await loadRole()
}

onMounted(async () => {
  await Promise.all([loadRole(), loadAll()])
})
</script>
