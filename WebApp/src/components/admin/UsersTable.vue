<!-- WebApp/src/components/admin/UsersTable.vue -->
<template>
  <n-data-table
    :columns="columns"
    :data="users"
    :bordered="false"
  />
  <n-empty v-if="users.length === 0" description="No users found." class="mt-4" />
</template>

<script setup lang="ts">
import { ref, h } from 'vue';
import { NDataTable, NEmpty, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';

interface User {
  id: number;
  name: string;
  email: string;
  role: string; // Assuming enum is mapped to string
}

// Dummy data for users
const users = ref<User[]>([
  { id: 1, name: 'Admin User', email: 'admin@example.com', role: 'Admin' },
  { id: 2, name: 'Customer User', email: 'customer@example.com', role: 'Customer' },
  { id: 3, name: 'Provider User', email: 'provider@example.com', role: 'Provider' },
]);

const createColumns = (): DataTableColumns<User> => {
  return [
    {
      title: 'ID',
      key: 'id',
    },
    {
      title: 'Name',
      key: 'name',
    },
    {
      title: 'Email',
      key: 'email',
    },
    {
      title: 'Role',
      key: 'role',
      render(row) {
        let tagType: 'success' | 'info' | 'warning' | 'error' | 'default' = 'default';
        if (row.role === 'Admin') tagType = 'error';
        else if (row.role === 'Provider') tagType = 'warning';
        else if (row.role === 'Customer') tagType = 'info';

        return h(
          NTag,
          {
            type: tagType,
            bordered: false,
          },
          {
            default: () => row.role,
          }
        );
      },
    },
  ];
};

const columns = createColumns();
</script>

<style scoped>
.mt-4 {
  margin-top: 1rem;
}
</style>
