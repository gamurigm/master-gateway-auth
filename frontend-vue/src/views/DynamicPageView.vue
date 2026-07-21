<template>
  <div class="admin-page">
    <div class="admin-header">
      <span class="eyebrow">Ruta dinámica</span>
      <h1>{{ menu?.name || 'Página' }}</h1>
    </div>

    <div class="hero-section">
      <AppIcon :name="menu?.icon || 'plug'" size="28" />
      <div>
        <p class="hero-label">Registrada en tiempo de ejecución desde el menú del Master</p>
        <p class="hero-value">{{ route.fullPath }}</p>
      </div>
    </div>

    <div class="dynamic-panel">
      <p>
        Esta vista <strong>no está declarada en el código</strong> del frontend. La ruta se
        inyectó dinámicamente con <code>router.addRoute()</code> a partir del árbol de menús que
        devuelve el microservicio Master, cumpliendo el requisito de enrutamiento basado en menú
        (sin rutas hardcodeadas).
      </p>

      <dl class="meta-grid" v-if="menu">
        <div><dt>Nombre</dt><dd>{{ menu.name }}</dd></div>
        <div><dt>URL destino</dt><dd><code>{{ menu.url }}</code></dd></div>
        <div><dt>Ícono</dt><dd>{{ menu.icon || '—' }}</dd></div>
        <div><dt>ID de menú</dt><dd><code>{{ menu.id }}</code></dd></div>
      </dl>

      <div v-if="externalUrl" class="dynamic-actions">
        <a :href="externalUrl" target="_blank" rel="noopener noreferrer" class="primary-button">
          Abrir servicio externo
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import type { MenuNode } from '../types'
import AppIcon from '../components/AppIcon.vue'

const route = useRoute()

// El registrador guarda el nodo de menú en meta.menu.
const menu = computed(() => route.meta.menu as MenuNode | undefined)

// Si la URL es absoluta (http...), se ofrece abrirla en otra pestaña.
const externalUrl = computed(() => {
  const url = menu.value?.url ?? ''
  return /^https?:\/\//i.test(url) ? url : null
})
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
  margin: 1.25rem 0 0;
}
.meta-grid dt {
  font-size: 0.75rem;
  text-transform: uppercase;
  opacity: 0.6;
  letter-spacing: 0.04em;
}
.meta-grid dd {
  margin: 0.25rem 0 0;
  font-weight: 600;
}
.dynamic-actions {
  margin-top: 1.5rem;
}
</style>
