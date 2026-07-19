<template>
  <div class="admin-page">
    <div class="admin-header">
      <span class="eyebrow">Arquitectura</span>
      <h1>{{ isEdit ? 'Editar modulo' : 'Nuevo modulo' }}</h1>
      <router-link to="/app/modules" class="secondary-button">Volver</router-link>
    </div>
    <div class="admin-card">
      <form @submit.prevent="saveModule">
        <div class="field"><label>Codigo</label><input v-model="form.code" required /></div>
        <div class="field"><label>Nombre</label><input v-model="form.name" required /></div>
        <div class="field"><label>Descripcion</label><input v-model="form.description" /></div>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" class="primary-button" :disabled="saving">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { modulesService } from '../services/modules.service'

const route = useRoute()
const router = useRouter()
const isEdit = computed(() => !!route.params.id)
const saving = ref(false)
const error = ref('')
const form = ref({ code: '', name: '', description: '' })

async function saveModule() {
  saving.value = true; error.value = ''
  try {
    const dto = { code: form.value.code, name: form.value.name, description: form.value.description || undefined }
    if (isEdit.value) await modulesService.update(route.params.id as string, dto)
    else await modulesService.create(dto)
    router.push('/app/modules')
  } catch (e: unknown) { error.value = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al guardar' }
  finally { saving.value = false }
}

onMounted(async () => {
  if (isEdit.value) {
    const { data } = await modulesService.findOne(route.params.id as string)
    form.value = { code: data.code, name: data.name, description: data.description || '' }
  }
})
</script>
