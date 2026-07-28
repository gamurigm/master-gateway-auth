<template>
  <main class="auth-page">
    <div class="auth-panel">
      <div class="auth-header">
        <AppIcon
          name="shield-off"
          size="40"
        />
        <h1>Acceso denegado</h1>
        <p>No tiene permisos para acceder a este recurso</p>
      </div>
      <router-link
        to="/app"
        class="primary-button"
        style="text-align: center; display: block"
      >
        Volver al inicio
      </router-link>
    </div>
  </main>
</template>

<script setup lang="ts">
import AppIcon from '../components/AppIcon.vue'
</script>
