<!-- WebApp/src/components/admin/BookingsTable.vue -->
<template>
  <n-data-table
    :columns="columns"
    :data="bookings"
    :bordered="false"
  />
  <n-empty v-if="bookings.length === 0" description="No bookings found." class="mt-4" />
</template>

<script setup lang="ts">
import { ref, h } from 'vue';
import { NDataTable, NEmpty, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { format } from 'date-fns';

interface AdminBooking {
  id: number;
  customerId: number;
  customerName: string;
  providerId: number;
  providerName: string;
  serviceId: number;
  serviceName: string;
  slotStartTime: string;
  slotEndTime: string;
  status: string; // Assuming enum or string representation
  createTime: string;
  creator: string;
  updateTime: string;
  updater: string;
}

// Dummy data for admin bookings
const bookings = ref<AdminBooking[]>([
  {
    id: 1,
    customerId: 101,
    customerName: 'John Doe',
    providerId: 201,
    providerName: 'Dr. Smith',
    serviceId: 301,
    serviceName: 'Consultation',
    slotStartTime: new Date().toISOString(),
    slotEndTime: new Date(Date.now() + 3600000).toISOString(),
    status: 'Confirmed',
    createTime: new Date().toISOString(),
    creator: 'System',
    updateTime: new Date().toISOString(),
    updater: 'System',
  },
  {
    id: 2,
    customerId: 102,
    customerName: 'Jane Doe',
    providerId: 202,
    providerName: 'Yoga Studio',
    serviceId: 302,
    serviceName: 'Yoga Class',
    slotStartTime: new Date(Date.now() + 86400000).toISOString(),
    slotEndTime: new Date(Date.now() + 86400000 + 3600000).toISOString(),
    status: 'Pending',
    createTime: new Date().toISOString(),
    creator: 'System',
    updateTime: new Date().toISOString(),
    updater: 'System',
  },
]);

const createColumns = (): DataTableColumns<AdminBooking> => {
  return [
    {
      title: 'ID',
      key: 'id',
    },
    {
      title: 'Customer',
      key: 'customerName',
    },
    {
      title: 'Provider',
      key: 'providerName',
    },
    {
      title: 'Service',
      key: 'serviceName',
    },
    {
      title: 'Slot Time',
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
            type: tagType,
            bordered: false,
          },
          {
            default: () => row.status,
          }
        );
      },
    },
    {
      title: 'Created',
      key: 'createTime',
      render(row) {
        return format(new Date(row.createTime), 'yyyy-MM-dd HH:mm');
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
