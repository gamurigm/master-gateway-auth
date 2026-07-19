<template>
  <main class="auth-page">
    <div class="auth-panel">
      <div class="auth-header">
        <AppIcon name="shield" size="40" />
        <h1>Master Gateway</h1>
        <p>Panel de administracion</p>
      </div>
      <form @submit.prevent="handleLogin" class="auth-form">
        <div class="field">
          <label for="email">Correo electronico</label>
          <input id="email" v-model="email" type="email" placeholder="admin@espe.edu.ec" required />
        </div>
        <div class="field">
          <label for="password">Contrasena</label>
          <div class="password-wrapper">
            <input id="password" v-model="password" :type="showPass ? 'text' : 'password'" placeholder="Ingrese su contrasena" required />
            <button type="button" class="toggle-pass" @click="showPass = !showPass">
              <AppIcon :name="showPass ? 'EyeOff' : 'Eye'" size="18" />
            </button>
          </div>
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" class="primary-button" :disabled="loading">
          <span v-if="loading" class="state-spinner" />
          <span v-else>Iniciar sesion</span>
        </button>
      </form>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authService } from '../services/auth.service'
import AppIcon from '../components/AppIcon.vue'

const router = useRouter()
const email = ref('')
const password = ref('')
const showPass = ref(false)
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  loading.value = true
  error.value = ''
  try {
    await authService.login(email.value, password.value)
    router.push('/select-role')
  } catch (e: unknown) {
    error.value = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al iniciar sesion'
  } finally {
    loading.value = false
  }
}
</script>
