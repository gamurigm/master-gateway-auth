<template>
  <div class="admin-page">
    <div class="admin-header">
      <span class="eyebrow">Identidad</span>
      <h1>{{ isEdit ? 'Editar usuario' : 'Nuevo usuario' }}</h1>
      <router-link to="/app/users" class="secondary-button">Volver</router-link>
    </div>
    <div class="admin-card">
      <form @submit.prevent="saveUser">
        <div class="field">
          <label>Email</label>
          <input v-model="form.email" type="email" required />
        </div>
        <div class="field">
          <label>Contrasena {{ isEdit ? '(dejar vacio para mantener)' : '' }}</label>
          <div class="password-wrapper">
            <input v-model="form.password" :type="showPass ? 'text' : 'password'" :required="!isEdit" />
            <button type="button" class="toggle-pass" @click="showPass = !showPass"><AppIcon :name="showPass ? 'EyeOff' : 'Eye'" size="18" /></button>
          </div>
        </div>
        <div class="field">
          <label>Nombres</label>
          <input v-model="form.firstName" required />
        </div>
        <div class="field">
          <label>Apellidos</label>
          <input v-model="form.lastName" />
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" class="primary-button" :disabled="saving">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usersService } from '../services/users.service'
import AppIcon from '../components/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const isEdit = computed(() => !!route.params.id)
const saving = ref(false)
const error = ref('')
const showPass = ref(false)
const form = ref({ email: '', password: '', firstName: '', lastName: '' })

async function saveUser() {
  saving.value = true
  error.value = ''
  try {
    const dto: Record<string, string> = { email: form.value.email, firstName: form.value.firstName }
    if (form.value.lastName) dto.lastName = form.value.lastName
    if (form.value.password) dto.password = form.value.password
    if (isEdit.value) {
      await usersService.update(route.params.id as string, dto)
    } else {
      await usersService.create(form.value as { email: string; password: string; firstName: string; lastName?: string })
    }
    router.push('/app/users')
  } catch (e: unknown) {
    error.value = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al guardar'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (isEdit.value) {
    try {
      const { data } = await usersService.findOne(route.params.id as string)
      form.value = { email: data.email, password: '', firstName: data.firstName, lastName: data.lastName || '' }
    } catch {
      router.push('/app/users')
    }
  }
})
</script>
