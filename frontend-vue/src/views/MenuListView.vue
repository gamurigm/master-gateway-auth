<template>
  <div class="admin-page">
    <div class="admin-header">
      <span class="eyebrow">Navegacion</span>
      <h1>Menus</h1>
      <button
        class="primary-button"
        @click="openCreate"
      >
        + Nuevo menu
      </button>
    </div>
    <template v-if="loading">
      <div class="list-state">
        <div class="state-spinner" /> Cargando...
      </div>
    </template>
    <template v-else-if="error">
      <div class="error-state">
        <p>{{ error }}</p><button
          class="secondary-button"
          @click="loadMenus"
        >
          Reintentar
        </button>
      </div>
    </template>
    <template v-else-if="menus.length === 0">
      <div class="empty-state">
        <p>No hay menus registrados</p><button
          class="primary-button"
          @click="openCreate"
        >
          + Crear primer menu
        </button>
      </div>
    </template>
    <table
      v-else
      class="crud-table"
    >
      <thead><tr><th>Nombre</th><th>URL</th><th>Icono</th><th>Orden</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>
        <tr
          v-for="m in menus"
          :key="m.id"
        >
          <td>{{ m.name }}</td>
          <td><code>{{ m.url || '—' }}</code></td>
          <td>{{ m.icon || '—' }}</td>
          <td>{{ m.order }}</td>
          <td>
            <span
              class="badge"
              :class="m.estado === 'ACTIVO' ? 'badge-active' : 'badge-inactive'"
            >{{ m.estado }}</span>
          </td>
          <td class="actions-cell">
            <button
              class="icon-btn edit"
              @click="openEdit(m)"
            >
              <AppIcon
                name="pencil"
                size="16"
              />
            </button>
            <button
              class="icon-btn delete"
              @click="handleDelete(m)"
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
      v-if="showModal"
      @close="closeModal"
    >
      <div class="modal-form">
        <h2>{{ editingMenu ? 'Editar menu' : 'Nuevo menu' }}</h2>
        <div class="field">
          <label>Nombre</label><input
            v-model="form.name"
            required
          >
        </div>
        <div class="field">
          <label>Ruta (URL)</label><input v-model="form.url">
        </div>
        <div class="field">
          <label>Icono</label><input v-model="form.icon">
        </div>
        <div class="field">
          <label>Orden</label><input
            v-model.number="form.order"
            type="number"
          >
        </div>
        <div class="field">
          <label>Modulo</label><select
            v-model="form.moduleId"
            required
          >
            <option value="">
              Seleccionar modulo...
            </option><option
              v-for="mod in allModules"
              :key="mod.id"
              :value="mod.id"
            >
              {{ mod.name }}
            </option>
          </select>
        </div>
        <div class="field">
          <label>Menu padre</label><select v-model="form.parentId">
            <option value="">
              — Ninguno —
            </option><option
              v-for="m in allMenus"
              :key="m.id"
              :value="m.id"
            >
              {{ m.name }}
            </option>
          </select>
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
            @click="saveMenu"
          >
            {{ saving ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </ModalWrapper>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { menuService } from '../services/menu.service'
import { modulesService } from '../services/modules.service'
import { useMenuStore } from '../stores/menu'
import type { Menu, SystemModule } from '../types'
import AppIcon from '../components/AppIcon.vue'
import ModalWrapper from '../components/ModalWrapper.vue'

const router = useRouter()
const menuStore = useMenuStore()
const menus = ref<Menu[]>([])
const allModules = ref<SystemModule[]>([])
const allMenus = ref<Menu[]>([])
const loading = ref(true)
const error = ref('')
const showModal = ref(false)
const editingMenu = ref<Menu | null>(null)
const saving = ref(false)
const formError = ref('')
const form = ref({ name: '', url: '', icon: '', order: 0, moduleId: '', parentId: '' })

function openCreate() { editingMenu.value = null; form.value = { name: '', url: '', icon: '', order: 0, moduleId: '', parentId: '' }; showModal.value = true; loadSelects() }
function openEdit(m: Menu) { editingMenu.value = m; form.value = { name: m.name, url: m.url || '', icon: m.icon || '', order: m.order, moduleId: m.moduleId, parentId: m.parentId || '' }; showModal.value = true; loadSelects() }
function closeModal() { showModal.value = false; editingMenu.value = null }

async function loadSelects() {
  try {
    const [modRes, menuRes] = await Promise.all([modulesService.findAll(), menuService.findAll()])
    allModules.value = modRes.data; allMenus.value = menuRes.data
  } catch {}
}

async function loadMenus() {
  loading.value = true; error.value = ''
  try { const { data } = await menuService.findAll(); menus.value = data }
  catch { error.value = 'Error al cargar menus' } finally { loading.value = false }
}

async function saveMenu() {
  saving.value = true; formError.value = ''
  try {
    const dto: Record<string, unknown> = { name: form.value.name, moduleId: form.value.moduleId }
    if (form.value.url) dto.url = form.value.url
    if (form.value.icon) dto.icon = form.value.icon
    if (form.value.order) dto.order = form.value.order
    if (form.value.parentId) dto.parentId = form.value.parentId
    if (editingMenu.value) {
      const { data } = await menuService.update(editingMenu.value.id, dto)
      menuStore.updateMenu(editingMenu.value.id, dto as Record<string, unknown>, router)
      // Update local flat list
      const idx = menus.value.findIndex((x) => x.id === editingMenu.value!.id)
      if (idx !== -1) menus.value[idx] = data
    } else {
      const { data } = await menuService.create(dto as { name: string; moduleId: string })
      menus.value.push(data)
      menuStore.addMenu(router, data)
    }
    closeModal()
  } catch (e: unknown) { formError.value = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al guardar' }
  finally { saving.value = false }
}

async function handleDelete(m: Menu) {
  if (!confirm(`¿Eliminar menu ${m.name}?`)) return
  try {
    await menuService.remove(m.id)
    menus.value = menus.value.filter((x) => x.id !== m.id)
    menuStore.removeMenu(router, m.id)
  }
  catch { error.value = 'Error al eliminar menu' }
}

onMounted(loadMenus)
</script>
