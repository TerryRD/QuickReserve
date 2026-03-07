<!-- WebApp/src/components/AppLayout.vue -->
<template>
  <n-layout>
    <n-layout-header bordered class="py-4 px-6 flex justify-between items-center">
      <div class="logo">QuickReserve</div>
      <n-menu mode="horizontal" :options="menuOptions" />
    </n-layout-header>
    <n-layout-content content-style="padding: 24px;">
      <slot></slot>
    </n-layout-content>
    <n-layout-footer bordered class="py-4 px-6 text-center text-gray-500">
      © 2026 QuickReserve. All rights reserved.
    </n-layout-footer>
  </n-layout>
</template>

<script setup lang="ts">
import { h, Component } from 'vue';
import { NLayout, NLayoutHeader, NLayoutContent, NLayoutFooter, NMenu } from 'naive-ui';
import { RouterLink } from 'vue-router';

// Define menu options (example)
const menuOptions = [
  {
    label: () => h(
      RouterLink,
      {
        to: {
          name: 'Home'
        }
      },
      { default: () => 'Home' }
    ),
    key: 'home'
  },
  {
    label: 'Dashboard',
    key: 'dashboard'
  },
  {
    label: 'Admin',
    key: 'admin'
  }
];
</script>

<style scoped>
/* Tailwind CSS can be used for styling, e.g., via utility classes */
.logo {
  font-size: 1.5rem;
  font-weight: bold;
}
</style>
