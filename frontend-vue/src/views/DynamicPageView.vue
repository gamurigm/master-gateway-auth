<template>
  <div class="admin-page">
    <div class="admin-header">
      <span class="eyebrow">Ruta dinamica</span>
      <h1>{{ menu?.name || 'Pagina' }}</h1>
    </div>

    <div class="hero-section">
      <AppIcon
        :name="menu?.icon || 'plug'"
        size="28"
      />
      <div>
        <p class="hero-label">
          Item registrado desde modulos y menus del Master
        </p>
        <p class="hero-value">
          {{ route.fullPath }}
        </p>
      </div>
    </div>

    <div class="dynamic-panel">
      <dl
        v-if="menu"
        class="meta-grid"
      >
        <div><dt>Nombre</dt><dd>{{ menu.name }}</dd></div>
        <div><dt>Ruta UI</dt><dd><code>{{ menu.url }}</code></dd></div>
        <div><dt>Proxy Gateway</dt><dd><code>{{ proxyPath || 'No aplica' }}</code></dd></div>
        <div><dt>ID de menu</dt><dd><code>{{ menu.id }}</code></dd></div>
      </dl>

      <div
        v-if="externalUrl"
        class="dynamic-actions"
      >
        <a
          :href="externalUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="primary-button"
        >
          Abrir servicio externo
        </a>
      </div>

      <div
        v-else
        class="proxy-result"
      >
        <div class="result-header">
          <h3>Respuesta del microservicio</h3>
          <button
            class="secondary-button"
            :disabled="loading || !proxyPath"
            @click="loadProxyData"
          >
            {{ loading ? 'Cargando...' : 'Recargar' }}
          </button>
        </div>

        <p
          v-if="loading"
          class="muted"
        >
          Consultando al microservicio via Gateway...
        </p>
        <p
          v-else-if="error"
          class="error"
        >
          {{ error }}
        </p>
        <DynamicDataTable
          v-else-if="hasPayload"
          :data="payload"
        />
        <p
          v-else
          class="muted"
        >
          Este item no tiene una ruta proxy consultable.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { MenuNode } from '../types'
import api from '../services/api'
import { internalAppPath, safeExternalUrl } from '../utils/safe-url'
import AppIcon from '../components/AppIcon.vue'
import DynamicDataTable from '../components/DynamicDataTable.vue'

const route = useRoute()
const loading = ref(false)
const error = ref('')
const payload = ref<unknown>()
const hasPayload = ref(false)

const menu = computed(() => route.meta.menu as MenuNode | undefined)
const externalUrl = computed(() => safeExternalUrl(menu.value?.url))
const proxyPath = computed(() => {
  const url = internalAppPath(menu.value?.url)
  if (!url) return null
  return `/proxy/${url.replace(/^\/app\/?/, '')}`
})

async function loadProxyData() {
  if (!proxyPath.value || externalUrl.value) return

  loading.value = true
  error.value = ''
  payload.value = undefined
  hasPayload.value = false
  try {
    const { data } = await api.get(proxyPath.value)
    payload.value = data
    hasPayload.value = true
  } catch (e: unknown) {
    error.value =
      (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
      (e as { message?: string })?.message ||
      'No se pudo consultar el microservicio'
  } finally {
    loading.value = false
  }
}

watch(
  () => route.fullPath,
  () => {
    void loadProxyData()
  },
  { immediate: true },
)
</script>

<style scoped>
.dynamic-panel {
  background: var(--surface, #1a1d24);
  border: 1px solid var(--border, #2a2e37);
  border-radius: 12px;
  padding: 1.5rem;
  margin-top: 1rem;
  line-height: 1.6;
}
.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin: 0 0 1.25rem;
}
.meta-grid dt {
  font-size: 0.75rem;
  text-transform: uppercase;
  opacity: 0.6;
}
.meta-grid dd {
  margin: 0.25rem 0 0;
  font-weight: 600;
}
.dynamic-actions {
  margin-top: 1.5rem;
}
.proxy-result {
  border-top: 1px solid var(--border, #2a2e37);
  padding-top: 1rem;
}
.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
}
.result-header h3 {
  margin: 0;
}

.muted {
  opacity: 0.7;
}
.error {
  color: var(--error-text);
}
</style>
