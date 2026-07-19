<template>
  <div class="app-shell">
    <Sidebar />
    <main class="workspace">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import Sidebar from '../components/Sidebar.vue'
</script>
