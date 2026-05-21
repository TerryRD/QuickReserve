<!-- WebApp/src/views/PublicProviderProfile.vue -->
<template>
  <div class="p-4">
    <n-h1>Provider Profile: {{ providerId }}</n-h1>
    <n-card class="mt-4">
      <n-h2>Services Offered</n-h2>
      <n-list bordered>
        <n-list-item v-for="service in providerServices" :key="service.id">
          <n-thing :title="service.name" :description="service.description" />
          <template #suffix>
            <n-text strong>${{ service.price }}</n-text>
            <n-tag type="info" class="ml-2">{{ service.durationInMinutes }} mins</n-tag>
          </template>
        </n-list-item>
      </n-list>
    </n-card>

    <n-card class="mt-4">
      <n-h2>Available Slots</n-h2>
      <!-- This will be replaced by a calendar or similar component -->
      <p>Display available slots here.</p>
      <!-- Example: <ProviderScheduleCalendar :slots="availableSlots" /> -->
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { NH1, NH2, NCard, NList, NListItem, NThing, NText, NTag } from 'naive-ui';

interface Service {
  id: number;
  name: string;
  description: string;
  durationInMinutes: number;
  price: number;
}

// Dummy data for services
const providerServices = ref<Service[]>([
  { id: 1, name: 'Consultation', description: 'One-on-one consultation', durationInMinutes: 60, price: 100 },
  { id: 2, name: 'Therapy Session', description: 'Relaxing therapy session', durationInMinutes: 90, price: 150 },
]);

const route = useRoute();
const providerId = ref<string | string[] | null>(null);

onMounted(() => {
  providerId.value = route.params.providerId;
});
</script>

<style scoped>
/* Add styles as needed */
</style>
