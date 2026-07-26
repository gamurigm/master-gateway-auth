<template>
  <li>
    <router-link
      v-if="node.url?.startsWith('/app/')"
      :to="node.url"
      class="menu-link"
    >
      <AppIcon v-if="node.icon" :name="node.icon" size="16" />
      <span>{{ node.name }}</span>
    </router-link>
    <a
      v-else-if="node.url"
      :href="node.url"
      target="_blank"
      rel="noopener noreferrer"
      class="menu-link"
    >
      <AppIcon v-if="node.icon" :name="node.icon" size="16" />
      <span>{{ node.name }}</span>
    </a>
    <span v-else class="menu-group">
      <AppIcon v-if="node.icon" :name="node.icon" size="16" />
      <span>{{ node.name }}</span>
    </span>
    <ul v-if="node.children.length" class="child-menu">
      <MenuItem v-for="child in node.children" :key="child.id" :node="child" />
    </ul>
  </li>
</template>

<script setup lang="ts">
import type { MenuNode } from '../types'
import AppIcon from './AppIcon.vue'

defineProps<{ node: MenuNode }>()
</script>
