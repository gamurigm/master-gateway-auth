<template>
  <div class="admin-page">
    <div class="admin-header">
      <span class="eyebrow">Ecosistema</span>
      <h1>Registrar servicio externo</h1>
    </div>

    <ol class="wizard-steps">
      <li :class="{ active: step === 1, done: step > 1 }">1. Conexión</li>
      <li :class="{ active: step === 2, done: step > 2 }">2. Menús y roles</li>
      <li :class="{ active: step === 3 }">3. Confirmación</li>
    </ol>

    <!-- PASO 1: datos + probe -->
    <section v-if="step === 1" class="wizard-panel">
      <div class="field"><label>Código *</label><input v-model="form.code" placeholder="INVENTARIO" @input="resetProbe" /></div>
      <div class="field"><label>Nombre *</label><input v-model="form.name" placeholder="Inventario" /></div>
      <div class="field"><label>Descripción</label><input v-model="form.description" /></div>
      <div class="field"><label>URL base *</label><input v-model="form.baseUrl" placeholder="http://inventario:3010" @input="resetProbe" /></div>
      <div class="field"><label>Ruta de salud</label><input v-model="form.healthPath" placeholder="/health" @input="resetProbe" /></div>
      <div class="field"><label>Ruta OpenAPI (opcional)</label><input v-model="form.openApiPath" placeholder="/openapi.json" @input="resetProbe" /></div>

      <div class="probe-row">
        <button class="secondary-button" :disabled="probing || !canProbe" @click="runProbe">
          {{ probing ? 'Probando...' : 'Probar conexión' }}
        </button>
        <span v-if="probeResult" class="probe-status" :class="probeResult.reachable ? 'ok' : 'fail'">
          <AppIcon :name="probeResult.reachable ? 'check-circle' : 'x-circle'" size="18" />
          {{ probeResult.reachable ? `En línea · ${probeResult.latencyMs} ms · HTTP ${probeResult.statusCode}` : (probeResult.error || 'No responde') }}
        </span>
      </div>

      <div v-if="probeResult?.reachable && probeResult.discoveredEndpoints.length" class="discovered">
        <p>Se descubrieron {{ probeResult.discoveredEndpoints.length }} endpoint(s) GET vía OpenAPI.</p>
      </div>

      <p v-if="stepError" class="error">{{ stepError }}</p>

      <div class="wizard-actions">
        <router-link class="secondary-button" to="/app/external-services">Cancelar</router-link>
        <button class="primary-button" :disabled="!probeResult?.reachable" @click="goToStep2">
          Siguiente
        </button>
      </div>
    </section>

    <!-- PASO 2: seleccionar menús y roles -->
    <section v-else-if="step === 2" class="wizard-panel">
      <h3>¿Qué endpoints se convierten en menú?</h3>
      <table class="crud-table">
        <thead><tr><th></th><th>Nombre del menú</th><th>Ruta interna</th></tr></thead>
        <tbody>
          <tr v-for="(item, i) in menuItems" :key="i">
            <td><input type="checkbox" v-model="item.enabled" /></td>
            <td><input v-model="item.name" :disabled="!item.enabled" /></td>
            <td><code>{{ item.path }}</code></td>
          </tr>
        </tbody>
      </table>
      <button class="secondary-button add-item" @click="addManualItem">+ Añadir menú manual</button>

      <h3>¿Qué roles reciben acceso?</h3>
      <div class="roles-grid">
        <label v-for="r in roles" :key="r.id" class="role-check">
          <input type="checkbox" :value="r.id" v-model="selectedRoles" />
          {{ r.name }}
        </label>
      </div>

      <p v-if="stepError" class="error">{{ stepError }}</p>

      <div class="wizard-actions">
        <button class="secondary-button" @click="step = 1">Atrás</button>
        <button class="primary-button" @click="goToStep3">Siguiente</button>
      </div>
    </section>

    <!-- PASO 3: confirmación -->
    <section v-else class="wizard-panel">
      <h3>Confirmar</h3>
      <dl class="meta-grid">
        <div><dt>Servicio</dt><dd>{{ form.name }} (<code>{{ form.code }}</code>)</dd></div>
        <div><dt>URL base</dt><dd><code>{{ form.baseUrl }}</code></dd></div>
        <div><dt>Menús a crear</dt><dd>{{ enabledItems.length }}</dd></div>
        <div><dt>Roles</dt><dd>{{ selectedRoleNames.join(', ') }}</dd></div>
      </dl>

      <ul class="preview-list">
        <li v-for="(item, i) in enabledItems" :key="i">
          <AppIcon name="link" size="14" /> {{ item.name }} → <code>{{ item.path }}</code>
        </li>
      </ul>

      <p v-if="stepError" class="error">{{ stepError }}</p>

      <div class="wizard-actions">
        <button class="secondary-button" :disabled="submitting" @click="step = 2">Atrás</button>
        <button class="primary-button" :disabled="submitting" @click="submit">
          {{ submitting ? 'Registrando...' : 'Registrar y aprovisionar' }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { externalServicesService } from '../services/external-services.service'
import { rolesService } from '../services/roles.service'
import { useMenuStore } from '../stores/menu'
import type { ProbeResult, Role } from '../types'
import AppIcon from '../components/AppIcon.vue'

const router = useRouter()
const menuStore = useMenuStore()

const step = ref(1)
const stepError = ref('')
const probing = ref(false)
const submitting = ref(false)
const probeResult = ref<ProbeResult | null>(null)

const form = ref({
  code: '',
  name: '',
  description: '',
  baseUrl: '',
  healthPath: '/health',
  openApiPath: '',
})

interface MenuItemDraft {
  enabled: boolean
  name: string
  path: string
}
const menuItems = ref<MenuItemDraft[]>([])
const roles = ref<Role[]>([])
const selectedRoles = ref<string[]>([])

const canProbe = computed(() => /^https?:\/\/.+/i.test(form.value.baseUrl))
const enabledItems = computed(() => menuItems.value.filter((i) => i.enabled && i.name.trim()))
const selectedRoleNames = computed(() =>
  roles.value.filter((r) => selectedRoles.value.includes(r.id)).map((r) => r.name),
)

function slug(): string {
  return (form.value.code || 'servicio').toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function resetProbe() {
  // Cualquier cambio en los datos de conexión invalida el probe anterior: no se
  // puede avanzar con una verificación obsoleta.
  probeResult.value = null
}

async function runProbe() {
  probing.value = true
  stepError.value = ''
  try {
    const { data } = await externalServicesService.probe({
      baseUrl: form.value.baseUrl,
      healthPath: form.value.healthPath || undefined,
      openApiPath: form.value.openApiPath || undefined,
    })
    probeResult.value = data
    if (!data.reachable) {
      stepError.value = data.error || 'El servicio no respondió correctamente'
    }
  } catch (e: unknown) {
    stepError.value = extractError(e)
    probeResult.value = null
  } finally {
    probing.value = false
  }
}

function goToStep2() {
  if (!form.value.code.trim() || !form.value.name.trim()) {
    stepError.value = 'Código y nombre son obligatorios'
    return
  }
  // Prellenar los menús con los endpoints descubiertos.
  menuItems.value = (probeResult.value?.discoveredEndpoints ?? []).map((ep) => ({
    enabled: true,
    name: ep.name,
    path: `/app/${slug()}${ep.path}`,
  }))
  if (menuItems.value.length === 0) {
    addManualItem()
  }
  stepError.value = ''
  step.value = 2
}

function addManualItem() {
  menuItems.value.push({ enabled: true, name: '', path: `/app/${slug()}/nuevo` })
}

function goToStep3() {
  if (enabledItems.value.length === 0) {
    stepError.value = 'Selecciona al menos un endpoint con nombre'
    return
  }
  if (selectedRoles.value.length === 0) {
    stepError.value = 'Selecciona al menos un rol'
    return
  }
  stepError.value = ''
  step.value = 3
}

async function submit() {
  submitting.value = true
  stepError.value = ''
  try {
    // El backend vuelve a verificar el probe en create(): registrar un servicio
    // caído generaría menús rotos.
    const { data: service } = await externalServicesService.create({
      code: form.value.code,
      name: form.value.name,
      description: form.value.description || undefined,
      baseUrl: form.value.baseUrl,
      healthPath: form.value.healthPath || undefined,
      openApiPath: form.value.openApiPath || undefined,
    })

    await externalServicesService.provision(service.id, {
      roleIds: selectedRoles.value,
      items: enabledItems.value.map((i) => ({ name: i.name, path: i.path })),
    })

    // Recarga el menú y re-registra las rutas: el nuevo módulo aparece en el
    // sidebar y sus rutas quedan navegables SIN recargar la página.
    await menuStore.load(router, true)
    router.push('/app/external-services')
  } catch (e: unknown) {
    stepError.value = extractError(e)
  } finally {
    submitting.value = false
  }
}

function extractError(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
      ?.toString() || 'Ocurrió un error'
  )
}

onMounted(async () => {
  try {
    const { data } = await rolesService.findAll()
    roles.value = data
  } catch {
    stepError.value = 'No se pudieron cargar los roles'
  }
})
</script>

<style scoped>
.wizard-steps {
  display: flex;
  gap: 0.5rem;
  list-style: none;
  padding: 0;
  margin: 0 0 1.5rem;
  flex-wrap: wrap;
}
.wizard-steps li {
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  background: var(--surface, #1a1d24);
  border: 1px solid var(--border, #2a2e37);
  font-size: 0.85rem;
  opacity: 0.6;
}
.wizard-steps li.active { opacity: 1; border-color: var(--accent, #4f8cff); color: var(--accent, #4f8cff); }
.wizard-steps li.done { opacity: 1; }
.wizard-panel {
  background: var(--surface, #1a1d24);
  border: 1px solid var(--border, #2a2e37);
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 720px;
}
.field { margin-bottom: 1rem; }
.field label { display: block; font-size: 0.8rem; opacity: 0.7; margin-bottom: 0.3rem; }
.field input { width: 100%; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border, #2a2e37); background: var(--bg, #12141a); color: inherit; }
.probe-row { display: flex; align-items: center; gap: 1rem; margin: 1rem 0; flex-wrap: wrap; }
.probe-status { display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 600; }
.probe-status.ok { color: #6bd18f; }
.probe-status.fail { color: #ff8b8b; }
.discovered { opacity: 0.8; font-size: 0.9rem; }
.roles-grid { display: flex; flex-wrap: wrap; gap: 0.75rem; margin: 0.5rem 0 1rem; }
.role-check { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.75rem; border: 1px solid var(--border, #2a2e37); border-radius: 8px; }
.add-item { margin: 0.5rem 0 1.5rem; }
.meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
.meta-grid dt { font-size: 0.75rem; text-transform: uppercase; opacity: 0.6; }
.meta-grid dd { margin: 0.2rem 0 0; font-weight: 600; }
.preview-list { list-style: none; padding: 0; margin: 1rem 0; }
.preview-list li { padding: 0.4rem 0; display: flex; align-items: center; gap: 0.5rem; }
.wizard-actions { display: flex; justify-content: space-between; gap: 1rem; margin-top: 1.5rem; }
.error { color: #ff8b8b; margin-top: 1rem; }
</style>
