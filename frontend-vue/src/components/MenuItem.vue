<template>
  <li>
    <router-link
      v-if="internalPath"
      :to="internalPath"
      class="menu-link"
    >
      <AppIcon
        v-if="node.icon"
        :name="node.icon"
        size="16"
      />
      <span>{{ node.name }}</span>
    </router-link>
    <a
      v-else-if="externalUrl"
      :href="externalUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="menu-link"
    >
      <AppIcon
        v-if="node.icon"
        :name="node.icon"
        size="16"
      />
      <span>{{ node.name }}</span>
    </a>
    <span
      v-else
      class="menu-group"
    >
      <AppIcon
        v-if="node.icon"
        :name="node.icon"
        size="16"
      />
      <span>{{ node.name }}</span>
    </span>
    <ul
      v-if="node.children.length"
      class="child-menu"
    >
      <MenuItem
        v-for="child in node.children"
        :key="child.id"
        :node="child"
      />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MenuNode } from '../types'
import { internalAppPath, safeExternalUrl } from '../utils/safe-url'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ node: MenuNode }>()

// Un menu con una `url` que no sea `/app/...` ni `http(s)://` se renderiza como
// simple agrupador, nunca como enlace: asi `javascript:` deja de ser clicable.
const internalPath = computed(() => internalAppPath(props.node.url))
const externalUrl = computed(() => safeExternalUrl(props.node.url))
</script>
