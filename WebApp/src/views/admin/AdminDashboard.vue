<!-- WebApp/src/views/admin/AdminDashboard.vue -->
<template>
  <div class="p-4">
    <n-h1>Admin Dashboard</n-h1>
    <n-space vertical>
      <n-card>
        <n-h2>User Management</n-h2>
        <p>Overview of system users and their roles.</p>
        <!-- <UsersTable /> -->
      </n-card>
      <n-card>
        <n-h2>Booking Oversight</n-h2>
        <p>Monitor all bookings across the platform.</p>
        <!-- <BookingsTable /> -->
      </n-card>
    </n-space>
  </div>
</template>

<script setup lang="ts">
import { NH1, NH2, NCard, NSpace } from 'naive-ui';
import UsersTable from '@/components/admin/UsersTable.vue';
import BookingsTable from '@/components/admin/BookingsTable.vue';
</script>

<style scoped>
/* Add styles as needed */
</style>
