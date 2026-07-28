<template>
  <div class="admin-page">
    <div class="admin-header">
      <span class="eyebrow">Identidad</span>
      <h1>Usuarios</h1>
      <button
        class="primary-button"
        @click="openCreate"
      >
        + Nuevo usuario
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
          @click="loadUsers"
        >
          Reintentar
        </button>
      </div>
    </template>
    <template v-else-if="users.length === 0">
      <div class="empty-state">
        <p>No hay usuarios registrados</p>
        <button
          class="primary-button"
          @click="openCreate"
        >
          + Crear primer usuario
        </button>
      </div>
    </template>
    <table
      v-else
      class="crud-table"
    >
      <thead>
        <tr>
          <th>Email</th>
          <th>Nombres</th>
          <th>Apellidos</th>
          <th>Roles</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="u in users"
          :key="u.id"
        >
          <td><code>{{ u.email }}</code></td>
          <td>{{ u.firstName }}</td>
          <td>{{ u.lastName || '—' }}</td>
          <td class="roles-cell">
            <span
              v-for="assignment in u.roles || []"
              :key="assignment.id"
              class="role-chip"
            >{{ assignment.role.name }}</span>
            <span
              v-if="!u.roles?.length"
              class="muted-text"
            >Sin rol</span>
          </td>
          <td>
            <span
              class="badge"
              :class="u.estado === 'ACTIVO' ? 'badge-active' : 'badge-inactive'"
            >{{ u.estado }}</span>
          </td>
          <td class="actions-cell">
            <button
              class="icon-btn edit"
              title="Editar"
              @click="openEdit(u)"
            >
              <AppIcon
                name="pencil"
                size="16"
              />
            </button>
            <button
              class="icon-btn delete"
              :title="deleteActionLabel"
              @click="handleDelete(u)"
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
    <div
      v-if="total > limit"
      class="crud-footer"
    >
      <span class="page-info">Pagina {{ page }} de {{ totalPages }}</span>
      <button
        class="secondary-button"
        :disabled="page <= 1"
        @click="changePage(page - 1)"
      >
        Anterior
      </button>
      <button
        class="secondary-button"
        :disabled="page >= totalPages"
        @click="changePage(page + 1)"
      >
        Siguiente
      </button>
    </div>
    <ModalWrapper
      v-if="showModal"
      @close="closeModal"
    >
      <div class="modal-form">
        <h2>{{ editingUser ? 'Editar usuario' : 'Nuevo usuario' }}</h2>
        <div class="field">
          <label>Email</label>
          <input
            v-model="form.email"
            type="email"
            required
          >
        </div>
        <div class="field">
          <label>Contrasena{{ editingUser ? ' (dejar vacio para mantener)' : '' }}</label>
          <input
            v-model="form.password"
            :type="showPass ? 'text' : 'password'"
            :required="!editingUser"
          >
          <button
            type="button"
            class="toggle-pass"
            @click="showPass = !showPass"
          >
            <AppIcon
              :name="showPass ? 'EyeOff' : 'Eye'"
              size="18"
            />
          </button>
        </div>
        <div class="field">
          <label>Nombres</label>
          <input
            v-model="form.firstName"
            required
          >
        </div>
        <div class="field">
          <label>Apellidos</label>
          <input v-model="form.lastName">
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
            @click="closeModal"
          >
            Cancelar
          </button>
          <button
            class="primary-button"
            :disabled="saving"
            @click="saveUser"
          >
            {{ saving ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </ModalWrapper>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usersService } from '../services/users.service'
import { useAuthStore } from '../stores/auth'
import type { User } from '../types'
import AppIcon from '../components/AppIcon.vue'
import ModalWrapper from '../components/ModalWrapper.vue'

const authStore = useAuthStore()
const users = ref<User[]>([])
const loading = ref(true)
const error = ref('')
const page = ref(1)
const total = ref(0)
const limit = ref(10)
const showModal = ref(false)
const editingUser = ref<User | null>(null)
const saving = ref(false)
const formError = ref('')
const showPass = ref(false)

const form = ref({ email: '', password: '', firstName: '', lastName: '' })

const totalPages = computed(() => Math.ceil(total.value / limit.value))
const isSuperAdmin = computed(() => authStore.currentRole?.name === 'SUPER_ADMIN')
const deleteActionLabel = computed(() => isSuperAdmin.value ? 'Eliminar fisicamente' : 'Inactivar usuario')

function resetForm() {
  form.value = { email: '', password: '', firstName: '', lastName: '' }
  formError.value = ''
  showPass.value = false
}

function openCreate() {
  editingUser.value = null
  resetForm()
  showModal.value = true
}

function openEdit(u: User) {
  editingUser.value = u
  form.value = { email: u.email, password: '', firstName: u.firstName, lastName: u.lastName || '' }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingUser.value = null
  resetForm()
}

async function loadUsers() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await usersService.findAll(page.value, limit.value)
    users.value = data.items
    total.value = data.total
  } catch {
    error.value = 'Error al cargar usuarios'
  } finally {
    loading.value = false
  }
}

function changePage(p: number) {
  page.value = p
  loadUsers()
}

async function saveUser() {
  saving.value = true
  formError.value = ''
  try {
    if (editingUser.value) {
      const dto: Record<string, string> = { email: form.value.email, firstName: form.value.firstName }
      if (form.value.lastName) dto.lastName = form.value.lastName
      if (form.value.password) dto.password = form.value.password
      await usersService.update(editingUser.value.id, dto)
    } else {
      await usersService.create(form.value)
    }
    closeModal()
    await loadUsers()
  } catch (e: unknown) {
    formError.value = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al guardar'
  } finally {
    saving.value = false
  }
}

async function handleDelete(u: User) {
  const action = isSuperAdmin.value ? 'eliminar fisicamente' : 'inactivar'
  if (!confirm(`¿Deseas ${action} el usuario ${u.email}?`)) return
  try {
    await usersService.remove(u.id)
    await loadUsers()
  } catch {
    error.value = isSuperAdmin.value ? 'Error al eliminar usuario' : 'Error al inactivar usuario'
  }
}

onMounted(loadUsers)
</script>
