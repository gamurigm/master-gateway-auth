<template>
  <div class="admin-page">
    <div class="admin-header">
      <span class="eyebrow">Permisos</span>
      <h1>Roles</h1>
      <button
        class="primary-button"
        @click="openCreate"
      >
        + Nuevo rol
      </button>
    </div>
    <template v-if="loading">
      <div class="list-state">
        <div class="state-spinner" /> Cargando...
      </div>
    </template>
    <template v-else-if="error">
      <div class="error-state">
        <p>{{ error }}</p>
        <button
          class="secondary-button"
          @click="loadRoles"
        >
          Reintentar
        </button>
      </div>
    </template>
    <template v-else-if="roles.length === 0">
      <div class="empty-state">
        <p>No hay roles registrados</p><button
          class="primary-button"
          @click="openCreate"
        >
          + Crear primer rol
        </button>
      </div>
    </template>
    <table
      v-else
      class="crud-table"
    >
      <thead><tr><th>Nombre</th><th>Descripcion</th><th>Asignaciones</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>
        <tr
          v-for="r in roles"
          :key="r.id"
        >
          <td><strong>{{ r.name }}</strong></td>
          <td>{{ r.description || '-' }}</td>
          <td>
            <small>{{ r.users?.length || 0 }} usuarios, {{ r.modules?.length || 0 }} modulos, {{ r.menus?.length || 0 }} menus, {{ r.permissions?.length || 0 }} permisos</small>
          </td>
          <td>
            <span
              class="badge"
              :class="r.estado === 'ACTIVO' ? 'badge-active' : 'badge-inactive'"
            >{{ r.estado }}</span>
          </td>
          <td class="actions-cell">
            <button
              type="button"
              class="icon-btn assign"
              title="Asignaciones"
              @click.stop="openAssignments(r)"
            >
              <AppIcon
                name="check-square"
                size="16"
              />
            </button>
            <button
              class="icon-btn edit"
              title="Editar"
              @click="openEdit(r)"
            >
              <AppIcon
                name="pencil"
                size="16"
              />
            </button>
            <button
              class="icon-btn delete"
              title="Eliminar"
              @click="handleDelete(r)"
            >
              <AppIcon
                name="trash-2"
                size="16"
              />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <ModalWrapper
      v-if="showFormModal"
      @close="closeForm"
    >
      <div class="modal-form">
        <h2>{{ editingRole ? 'Editar rol' : 'Nuevo rol' }}</h2>
        <div class="field">
          <label>Nombre</label><input
            v-model="form.name"
            required
          >
        </div>
        <div class="field">
          <label>Descripcion</label><input v-model="form.description">
        </div>
        <p
          v-if="formError"
          class="error"
        >
          {{ formError }}
        </p>
        <div class="modal-actions">
          <button
            class="secondary-button"
            @click="closeForm"
          >
            Cancelar
          </button>
          <button
            class="primary-button"
            :disabled="saving"
            @click="saveRole"
          >
            {{ saving ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </ModalWrapper>
    <ModalWrapper
      v-if="showAssignModal && assignRole"
      @close="closeAssign"
    >
      <div class="modal-form assignment-form">
        <h2>Asignaciones: {{ assignRole.name }}</h2>
        <div class="assignment-grid">
          <p
            v-if="assignmentError"
            class="error assignment-error"
          >
            {{ assignmentError }}
          </p>
          <div
            v-if="assignmentLoading"
            class="list-state"
          >
            <div class="state-spinner" /> Cargando asignaciones...
          </div>
          <div class="assignment-section">
            <h3>Usuarios</h3>
            <div
              v-for="u in allUsers"
              :key="u.id"
              class="assignment-row"
            >
              <label><input
                type="checkbox"
                :checked="isAssigned('user', u.id)"
                @change="toggleUser(u)"
              > {{ u.email }}</label>
            </div>
          </div>
          <div class="assignment-section">
            <h3>Modulos</h3>
            <div
              v-for="m in allModules"
              :key="m.id"
              class="assignment-row"
            >
              <label><input
                type="checkbox"
                :checked="isAssigned('module', m.id)"
                @change="toggleModule(m)"
              > {{ m.name }}</label>
            </div>
          </div>
          <div class="assignment-section wide">
            <h3>Menus</h3>
            <div
              v-for="m in allMenus"
              :key="m.id"
              class="assignment-row"
            >
              <label><input
                type="checkbox"
                :checked="isAssigned('menu', m.id)"
                @change="toggleMenu(m)"
              > {{ m.name }}</label>
            </div>
          </div>
          <div class="assignment-section wide">
            <h3>Permisos</h3>
            <div
              v-for="p in allPermissions"
              :key="p.id"
              class="assignment-row"
            >
              <label><input
                type="checkbox"
                :checked="isAssigned('permission', p.id)"
                @change="togglePermission(p)"
              > <code>{{ p.code }}</code></label>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button
            type="button"
            class="primary-button"
            @click="closeAssign"
          >
            Cerrar
          </button>
        </div>
      </div>
    </ModalWrapper>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { rolesService } from '../services/roles.service'
import { usersService } from '../services/users.service'
import { modulesService } from '../services/modules.service'
import { menuService } from '../services/menu.service'
import { permissionsService } from '../services/permissions.service'
import type { Role, RoleDetail, User, SystemModule, Menu, Permission } from '../types'
import AppIcon from '../components/AppIcon.vue'
import ModalWrapper from '../components/ModalWrapper.vue'

const roles = ref<Role[]>([])
const loading = ref(true)
const error = ref('')

const showFormModal = ref(false)
const editingRole = ref<Role | null>(null)
const saving = ref(false)
const formError = ref('')
const form = ref({ name: '', description: '' })

const showAssignModal = ref(false)
const assignRole = ref<Role | RoleDetail | null>(null)
const allUsers = ref<User[]>([])
const allModules = ref<SystemModule[]>([])
const allMenus = ref<Menu[]>([])
const allPermissions = ref<Permission[]>([])
const assignmentLoading = ref(false)
const assignmentError = ref('')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isRecord(error)) {
    const response = error.response
    if (isRecord(response)) {
      const data = response.data
      if (typeof data === 'string' && data.trim()) return data
      if (isRecord(data)) {
        const message = data.message
        if (Array.isArray(message)) return message.join(', ')
        if (typeof message === 'string' && message.trim()) return message
        const detail = data.error
        if (typeof detail === 'string' && detail.trim()) return detail
      }
    }
  }

  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

function getApiStatus(error: unknown): number | undefined {
  if (!isRecord(error) || !isRecord(error.response)) return undefined
  const status = error.response.status
  return typeof status === 'number' ? status : undefined
}

function openCreate() {
  editingRole.value = null
  form.value = { name: '', description: '' }
  showFormModal.value = true
}

function openEdit(r: Role) {
  editingRole.value = r
  form.value = { name: r.name, description: r.description || '' }
  showFormModal.value = true
}

function closeForm() {
  showFormModal.value = false
  editingRole.value = null
}

function assignedUserId(assignment: unknown): string | undefined {
  const item = assignment as { user?: { id?: string }; role?: { id?: string } }
  return item.user?.id ?? item.role?.id
}
function isAssigned(type: 'user' | 'module' | 'menu' | 'permission', id: string): boolean {
  if (!assignRole.value) return false
  const r = assignRole.value as Role | RoleDetail
  if (type === 'user') return (r as Role | RoleDetail).users?.some((a) => assignedUserId(a) === id) ?? false
  if (type === 'module') return (r as Role).modules?.some((a) => a.module.id === id) ?? false
  if (type === 'menu') return (r as Role).menus?.some((a) => a.menu.id === id) ?? false
  return (r as Role).permissions?.some((a) => a.permission.id === id) ?? false
}

async function loadRoles() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await rolesService.findAll()
    roles.value = data
  } catch (e: unknown) {
    error.value = getApiErrorMessage(e, 'Error al cargar roles')
  } finally {
    loading.value = false
  }
}

async function saveRole() {
  saving.value = true
  formError.value = ''
  try {
    if (editingRole.value) {
      await rolesService.update(editingRole.value.id, form.value)
    } else {
      await rolesService.create(form.value)
    }
    closeForm()
    await loadRoles()
  } catch (e: unknown) {
    formError.value = getApiErrorMessage(e, 'Error al guardar')
  } finally {
    saving.value = false
  }
}

async function handleDelete(r: Role) {
  if (!confirm(`Eliminar rol ${r.name}?`)) return
  try {
    await rolesService.remove(r.id)
    await loadRoles()
  } catch (e: unknown) {
    error.value = getApiErrorMessage(e, 'Error al eliminar rol')
  }
}

async function openAssignments(r: Role) {
  assignRole.value = r
  showAssignModal.value = true
  assignmentLoading.value = true
  assignmentError.value = ''
  allUsers.value = []
  allModules.value = []
  allMenus.value = []
  allPermissions.value = []

  try {
    const results = await Promise.allSettled([
      usersService.findAll(1, 100),
      modulesService.findAll(),
      menuService.findAll(),
      permissionsService.findAll(),
    ])
    const [usersResult, modulesResult, menusResult, permissionsResult] = results
    if (usersResult.status === 'fulfilled') allUsers.value = usersResult.value.data.items
    if (modulesResult.status === 'fulfilled') allModules.value = modulesResult.value.data
    if (menusResult.status === 'fulfilled') allMenus.value = menusResult.value.data
    if (permissionsResult.status === 'fulfilled') allPermissions.value = permissionsResult.value.data

    const rejectedReasons = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => getApiStatus(r.reason))
    if (rejectedReasons.length > 0 && rejectedReasons.every((s) => s === 404)) {
      allPermissions.value = []
    } else if (rejectedReasons.length > 0) {
      const status = rejectedReasons[0]
      const firstRejected = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
      assignmentError.value = status === 403
        ? getApiErrorMessage(firstRejected?.reason, 'No tienes permisos para consultar uno de los catalogos.')
        : getApiErrorMessage(firstRejected?.reason, 'No se pudieron cargar todos los datos de asignacion.')
    }
  } finally {
    assignmentLoading.value = false
  }
}

function closeAssign() {
  showAssignModal.value = false
  assignRole.value = null
}

function reloadRoleSnapshot() {
  if (assignRole.value) {
    rolesService.findOne(assignRole.value.id).then(({ data }) => {
      assignRole.value = data
    })
  }
}

async function toggleUser(u: User) {
  if (!assignRole.value) return
  const assigned = assignRole.value.users?.some((a) => assignedUserId(a) === u.id)
  assignmentError.value = ''
  try {
    if (assigned) await rolesService.unassignUser(assignRole.value.id, u.id)
    else await rolesService.assignUser(assignRole.value.id, u.id)
    reloadRoleSnapshot()
    await loadRoles()
  } catch (e: unknown) {
    assignmentError.value = getApiErrorMessage(e, 'Error al actualizar usuarios')
  }
}

async function toggleModule(m: SystemModule) {
  if (!assignRole.value) return
  const assigned = assignRole.value.modules?.some((a) => a.module.id === m.id)
  assignmentError.value = ''
  try {
    if (assigned) await rolesService.unassignModule(assignRole.value.id, m.id)
    else await rolesService.assignModule(assignRole.value.id, m.id)
    reloadRoleSnapshot()
    await loadRoles()
  } catch (e: unknown) {
    assignmentError.value = getApiErrorMessage(e, 'Error al actualizar modulos')
  }
}

async function toggleMenu(m: Menu) {
  if (!assignRole.value) return
  const assigned = assignRole.value.menus?.some((a) => a.menu.id === m.id)
  assignmentError.value = ''
  try {
    if (assigned) await rolesService.unassignMenu(assignRole.value.id, m.id)
    else await rolesService.assignMenu(assignRole.value.id, m.id)
    reloadRoleSnapshot()
    await loadRoles()
  } catch (e: unknown) {
    assignmentError.value = getApiErrorMessage(e, 'Error al actualizar menus')
  }
}

async function togglePermission(p: Permission) {
  if (!assignRole.value) return
  const assigned = assignRole.value.permissions?.some((a) => a.permission.id === p.id)
  assignmentError.value = ''
  try {
    if (assigned) await rolesService.unassignPermission(assignRole.value.id, p.id)
    else await rolesService.assignPermission(assignRole.value.id, p.id)
    reloadRoleSnapshot()
    await loadRoles()
  } catch (e: unknown) {
    assignmentError.value = getApiErrorMessage(e, 'Error al actualizar permisos')
  }
}

onMounted(loadRoles)
</script>
