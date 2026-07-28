<template>
  <div class="admin-page">
    <div class="admin-header">
      <span class="eyebrow">Ecosistema</span>
      <h1>Servicios externos</h1>
      <router-link
        class="primary-button"
        to="/app/external-services/new"
      >
        + Registrar servicio
      </router-link>
    </div>

    <p class="page-intro">
      Registra microservicios hijos, verifica que respondan antes de exponerlos y genera su módulo
      y menús automáticamente. La navegación se inyecta en el frontend sin tocar código.
    </p>

    <template v-if="loading">
      <div class="list-state">
        <div class="state-spinner" /> Cargando...
      </div>
    </template>
    <template v-else-if="error">
      <div class="error-state">
        <p>{{ error }}</p><button
          class="secondary-button"
          @click="load"
        >
          Reintentar
        </button>
      </div>
    </template>
    <template v-else-if="services.length === 0">
      <div class="empty-state">
        <AppIcon
          name="plug"
          size="24"
        />
        <p>No hay servicios externos registrados</p>
        <router-link
          class="primary-button"
          to="/app/external-services/new"
        >
          + Registrar el primero
        </router-link>
      </div>
    </template>
    <table
      v-else
      class="crud-table"
    >
      <thead>
        <tr><th>Código</th><th>Nombre</th><th>URL base</th><th>Estado</th><th>Aprovisionado</th><th>Última verificación</th><th>Acciones</th></tr>
      </thead>
      <tbody>
        <tr
          v-for="s in services"
          :key="s.id"
        >
          <td><code>{{ s.code }}</code></td>
          <td>{{ s.name }}</td>
          <td><code class="url-cell">{{ s.baseUrl }}</code></td>
          <td>
            <span
              class="badge"
              :class="probeBadge(s)"
            >
              {{ s.lastProbeOk === null || s.lastProbeOk === undefined ? 'sin probar' : s.lastProbeOk ? 'en línea' : 'caído' }}
            </span>
          </td>
          <td>
            <span
              class="badge"
              :class="s.moduleId ? 'badge-active' : 'badge-inactive'"
            >
              {{ s.moduleId ? 'sí' : 'pendiente' }}
            </span>
          </td>
          <td>{{ s.lastProbeMs != null ? `${s.lastProbeMs} ms` : '—' }}</td>
          <td class="actions-cell">
            <button
              class="icon-btn"
              title="Re-verificar"
              :disabled="probingId === s.id"
              @click="reprobe(s)"
            >
              <AppIcon
                name="activity"
                size="16"
              />
            </button>
            <button
              class="icon-btn delete"
              title="Eliminar"
              @click="handleDelete(s)"
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { externalServicesService } from '../services/external-services.service'
import type { ExternalService } from '../types'
import AppIcon from '../components/AppIcon.vue'

const services = ref<ExternalService[]>([])
const loading = ref(true)
const error = ref('')
const probingId = ref<string | null>(null)

function probeBadge(s: ExternalService): string {
  if (s.lastProbeOk === null || s.lastProbeOk === undefined) return 'badge-inactive'
  return s.lastProbeOk ? 'badge-active' : 'badge-danger'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await externalServicesService.findAll()
    services.value = data
  } catch {
    error.value = 'Error al cargar los servicios externos'
  } finally {
    loading.value = false
  }
}

async function reprobe(s: ExternalService) {
  probingId.value = s.id
  try {
    await externalServicesService.probeExisting(s.id)
    await load()
  } catch {
    error.value = `No se pudo verificar ${s.name}`
  } finally {
    probingId.value = null
  }
}

async function handleDelete(s: ExternalService) {
  if (!confirm(`¿Eliminar el servicio ${s.name}? El módulo y menús generados quedarán inactivos.`)) return
  try {
    await externalServicesService.remove(s.id)
    await load()
  } catch {
    error.value = 'Error al eliminar el servicio'
  }
}

onMounted(load)
</script>

<style scoped>
.page-intro { opacity: 0.7; margin: 0 0 1.25rem; max-width: 60ch; line-height: 1.5; }
.url-cell { font-size: 0.85em; }
.badge-danger { background: #4a1d1d; color: #ff8b8b; }
</style>
