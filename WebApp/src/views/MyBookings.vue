<!-- WebApp/src/views/MyBookings.vue -->
<template>
  <div class="p-4">
    <n-h1>My Bookings</n-h1>
    <n-card class="mt-4">
      <n-h2>Your Booking History</n-h2>
      <n-data-table
        :columns="columns"
        :data="bookings"
        :bordered="false"
      />
      <n-empty v-if="bookings.length === 0" description="No bookings found." class="mt-4" />
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, h } from 'vue';
import { NH1, NH2, NCard, NDataTable, NEmpty, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { format } from 'date-fns';

interface Booking {
  id: number;
  customerName: string;
  providerName: string;
  serviceName: string;
  slotStartTime: string;
  slotEndTime: string;
  status: string;
}

// Dummy data for bookings
const bookings = ref<Booking[]>([
  {
    id: 1,
    customerName: 'John Doe',
    providerName: 'Dr. Smith',
    serviceName: 'Dental Checkup',
    slotStartTime: new Date().toISOString(),
    slotEndTime: new Date(Date.now() + 3600000).toISOString(),
    status: 'Confirmed',
  },
  {
    id: 2,
    customerName: 'Jane Doe',
    providerName: 'Yoga Studio',
    serviceName: 'Yoga Class',
    slotStartTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    slotEndTime: new Date(Date.now() + 86400000 + 3600000).toISOString(),
    status: 'Pending',
  },
]);

const createColumns = (): DataTableColumns<Booking> => {
  return [
    {
      title: 'Service',
      key: 'serviceName',
    },
    {
      title: 'Provider',
      key: 'providerName',
    },
    {
      title: 'Time',
      key: 'slotStartTime',
      render(row) {
        return h(
          'span',
          {},
          `${format(new Date(row.slotStartTime), 'MMM d, p')} - ${format(new Date(row.slotEndTime), 'p')}`
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      render(row) {
        let tagType: 'success' | 'info' | 'warning' | 'error' | 'default' = 'default';
        if (row.status === 'Confirmed') tagType = 'success';
        else if (row.status === 'Pending') tagType = 'info';
        else if (row.status === 'Cancelled') tagType = 'error';

        return h(
          NTag,
          {
            style: {
              marginRight: '6px',
            },
            type: tagType,
            bordered: false,
          },
          {
            default: () => row.status,
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
