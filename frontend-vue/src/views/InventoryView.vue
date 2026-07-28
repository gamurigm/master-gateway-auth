<template>
  <div class="admin-page">
    <div class="admin-header">
      <span class="eyebrow">Microservicio</span>
      <h1>Inventario</h1>
    </div>
    <div class="inventory-config">
      <div class="field api-field">
        <label>URL del microservicio</label>
        <div style="display:flex; gap:8px">
          <input
            v-model="apiUrl"
            placeholder="/inventario"
          >
          <button
            class="primary-button"
            :disabled="loadingProducts"
            @click="queryProducts"
          >
            Consultar
          </button>
        </div>
      </div>
    </div>
    <template v-if="loadingProducts">
      <div class="list-state">
        <div class="state-spinner" /> Consultando inventario...
      </div>
    </template>
    <template v-else-if="queryError">
      <div class="error-state">
        <AppIcon
          name="alert-triangle"
          size="24"
        />
        <p>{{ queryError }}</p>
        <button
          class="secondary-button"
          @click="queryProducts"
        >
          Reintentar
        </button>
      </div>
    </template>
    <template v-else-if="products.length === 0">
      <div class="empty-state">
        <AppIcon
          name="package"
          size="24"
        />
        <p>No hay productos o no se ha consultado</p>
      </div>
    </template>
    <table
      v-else
      class="crud-table"
    >
      <thead><tr><th>SKU</th><th>Producto</th><th>Stock</th><th>Estado</th></tr></thead>
      <tbody>
        <tr
          v-for="p in products"
          :key="p.sku"
        >
          <td><code>{{ p.sku }}</code></td>
          <td>{{ p.name }}</td>
          <td>{{ p.stock }}</td>
          <td>
            <span
              class="badge"
              :class="p.status === 'ACTIVO' ? 'badge-active' : 'badge-inactive'"
            >{{ p.status }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { inventarioService } from '../services/inventario.service'
import type { InventoryProduct } from '../types'
import AppIcon from '../components/AppIcon.vue'

const apiUrl = ref(localStorage.getItem('inventoryApiUrl') || '/inventario')
const products = ref<InventoryProduct[]>([])
const loadingProducts = ref(false)
const queryError = ref('')

async function queryProducts() {
  loadingProducts.value = true
  queryError.value = ''
  localStorage.setItem('inventoryApiUrl', apiUrl.value)
  try {
    const data = await inventarioService.findProducts(apiUrl.value)
    products.value = data.items
  } catch {
    queryError.value = 'Error al consultar inventario'
  } finally {
    loadingProducts.value = false
  }
}
</script>
