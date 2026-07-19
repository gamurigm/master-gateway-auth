<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-panel">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineEmits<{ close: [] }>()
</script>
