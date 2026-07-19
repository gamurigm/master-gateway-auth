<template>
  <div class="admin-page">
    <div class="admin-header">
      <span class="eyebrow">Permisos</span>
      <h1>{{ isEdit ? 'Editar rol' : 'Nuevo rol' }}</h1>
      <router-link to="/app/roles" class="secondary-button">Volver</router-link>
    </div>
    <div class="admin-card">
      <form @submit.prevent="saveRole">
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
import { rolesService } from '../services/roles.service'

const route = useRoute()
const router = useRouter()
const isEdit = computed(() => !!route.params.id)
const saving = ref(false)
const error = ref('')
const form = ref({ name: '', description: '' })

async function saveRole() {
  saving.value = true
  error.value = ''
  try {
    if (isEdit.value) await rolesService.update(route.params.id as string, form.value)
    else await rolesService.create(form.value)
    router.push('/app/roles')
  } catch (e: unknown) {
    error.value = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al guardar'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (isEdit.value) {
    const { data } = await rolesService.findOne(route.params.id as string)
    form.value = { name: data.name, description: data.description || '' }
  }
})
</script>
