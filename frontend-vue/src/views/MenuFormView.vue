<template>
  <div class="admin-page">
    <div class="admin-header">
      <span class="eyebrow">Navegacion</span>
      <h1>{{ isEdit ? 'Editar menu' : 'Nuevo menu' }}</h1>
      <router-link to="/app/menus" class="secondary-button">Volver</router-link>
    </div>
    <div class="admin-card">
      <form @submit.prevent="saveMenu">
        <div class="field"><label>Nombre</label><input v-model="form.name" required /></div>
        <div class="field"><label>Ruta (URL)</label><input v-model="form.url" /></div>
        <div class="field"><label>Icono</label><input v-model="form.icon" /></div>
        <div class="field"><label>Orden</label><input v-model.number="form.order" type="number" /></div>
        <div class="field"><label>Modulo</label><select v-model="form.moduleId" required><option value="">Seleccionar...</option><option v-for="mod in allModules" :key="mod.id" :value="mod.id">{{ mod.name }}</option></select></div>
        <div class="field"><label>Menu padre</label><select v-model="form.parentId"><option value="">— Ninguno —</option><option v-for="m in allMenus" :key="m.id" :value="m.id">{{ m.name }}</option></select></div>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" class="primary-button" :disabled="saving">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { menuService } from '../services/menu.service'
import { modulesService } from '../services/modules.service'
import type { SystemModule, Menu } from '../types'

const route = useRoute()
const router = useRouter()
const isEdit = computed(() => !!route.params.id)
const saving = ref(false)
const error = ref('')
const allModules = ref<SystemModule[]>([])
const allMenus = ref<Menu[]>([])
const form = ref({ name: '', url: '', icon: '', order: 0, moduleId: '', parentId: '' })

async function saveMenu() {
  saving.value = true; error.value = ''
  try {
    const dto: Record<string, unknown> = { name: form.value.name, moduleId: form.value.moduleId }
    if (form.value.url) dto.url = form.value.url
    if (form.value.icon) dto.icon = form.value.icon
    if (form.value.order) dto.order = form.value.order
    if (form.value.parentId) dto.parentId = form.value.parentId
    if (isEdit.value) await menuService.update(route.params.id as string, dto)
    else await menuService.create(dto as { name: string; moduleId: string })
    router.push('/app/menus')
  } catch (e: unknown) { error.value = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al guardar' }
  finally { saving.value = false }
}

onMounted(async () => {
  try {
    const [modRes, menuRes] = await Promise.all([modulesService.findAll(), menuService.findAll()])
    allModules.value = modRes.data; allMenus.value = menuRes.data
  } catch {}
  if (isEdit.value) {
    const { data } = await menuService.findOne(route.params.id as string)
    form.value = { name: data.name, url: data.url || '', icon: data.icon || '', order: data.order, moduleId: data.moduleId, parentId: data.parentId || '' }
  }
})
</script>
