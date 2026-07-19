<template>
  <div class="admin-page">
    <div class="admin-header">
      <span class="eyebrow">Arquitectura</span>
      <h1>Modulos</h1>
      <button class="primary-button" @click="openCreate">+ Nuevo modulo</button>
    </div>
    <template v-if="loading"><div class="list-state"><div class="state-spinner" /> Cargando...</div></template>
    <template v-else-if="error"><div class="error-state"><p>{{ error }}</p><button class="secondary-button" @click="loadModules">Reintentar</button></div></template>
    <template v-else-if="modules.length === 0"><div class="empty-state"><p>No hay modulos registrados</p><button class="primary-button" @click="openCreate">+ Crear primer modulo</button></div></template>
    <table v-else class="crud-table">
      <thead><tr><th>Codigo</th><th>Nombre</th><th>Descripcion</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>
        <tr v-for="m in modules" :key="m.id">
          <td><code>{{ m.code }}</code></td>
          <td>{{ m.name }}</td>
          <td>{{ m.description || '—' }}</td>
          <td><span class="badge" :class="m.estado === 'ACTIVO' ? 'badge-active' : 'badge-inactive'">{{ m.estado }}</span></td>
          <td class="actions-cell">
            <button class="icon-btn edit" @click="openEdit(m)"><AppIcon name="pencil" size="16" /></button>
            <button class="icon-btn delete" @click="handleDelete(m)"><AppIcon name="trash-2" size="16" /></button>
          </td>
        </tr>
      </tbody>
    </table>
    <ModalWrapper v-if="showModal" @close="closeModal">
      <div class="modal-form">
        <h2>{{ editingModule ? 'Editar modulo' : 'Nuevo modulo' }}</h2>
        <div class="field"><label>Codigo</label><input v-model="form.code" required /></div>
        <div class="field"><label>Nombre</label><input v-model="form.name" required /></div>
        <div class="field"><label>Descripcion</label><input v-model="form.description" /></div>
        <p v-if="formError" class="error">{{ formError }}</p>
        <div class="modal-actions">
          <button class="secondary-button" @click="closeModal">Cancelar</button>
          <button class="primary-button" :disabled="saving" @click="saveModule">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
        </div>
      </div>
    </ModalWrapper>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { modulesService } from '../services/modules.service'
import type { SystemModule } from '../types'
import AppIcon from '../components/AppIcon.vue'
import ModalWrapper from '../components/ModalWrapper.vue'

const modules = ref<SystemModule[]>([])
const loading = ref(true)
const error = ref('')
const showModal = ref(false)
const editingModule = ref<SystemModule | null>(null)
const saving = ref(false)
const formError = ref('')
const form = ref({ code: '', name: '', description: '' })

function openCreate() { editingModule.value = null; form.value = { code: '', name: '', description: '' }; showModal.value = true }
function openEdit(m: SystemModule) { editingModule.value = m; form.value = { code: m.code, name: m.name, description: m.description || '' }; showModal.value = true }
function closeModal() { showModal.value = false; editingModule.value = null }

async function loadModules() {
  loading.value = true; error.value = ''
  try { const { data } = await modulesService.findAll(); modules.value = data }
  catch { error.value = 'Error al cargar modulos' } finally { loading.value = false }
}

async function saveModule() {
  saving.value = true; formError.value = ''
  try {
    if (editingModule.value) await modulesService.update(editingModule.value.id, form.value)
    else await modulesService.create({ code: form.value.code, name: form.value.name, description: form.value.description || undefined })
    closeModal(); await loadModules()
  } catch (e: unknown) { formError.value = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al guardar' }
  finally { saving.value = false }
}

async function handleDelete(m: SystemModule) {
  if (!confirm(`¿Eliminar modulo ${m.name}?`)) return
  try { await modulesService.remove(m.id); await loadModules() }
  catch { error.value = 'Error al eliminar modulo' }
}

onMounted(loadModules)
</script>
