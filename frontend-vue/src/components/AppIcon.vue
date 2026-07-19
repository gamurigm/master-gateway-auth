<template>
  <component :is="iconComponent" v-bind="$attrs" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import * as LucideIcons from '@lucide/vue'

const props = defineProps<{ name: string }>()

const iconComponent = computed(() => {
  const pascal = props.name.replace(/(?:^|-)(\w)/g, (_, c) => c.toUpperCase())
  const icon = (LucideIcons as Record<string, unknown>)[pascal]
  return icon || LucideIcons.Box
})
</script>
