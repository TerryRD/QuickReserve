<!-- WebApp/src/components/BookingForm.vue -->
<template>
  <n-card title="Book a Service">
    <n-form ref="formRef" :model="formValue" :rules="rules">
      <n-form-item label="Select Service" path="serviceId">
        <n-select
          v-model:value="formValue.serviceId"
          :options="serviceOptions"
          placeholder="Select a service"
          clearable
        />
      </n-form-item>
      <n-form-item label="Select Available Slot" path="availabilitySlotId">
        <n-select
          v-model:value="formValue.availabilitySlotId"
          :options="availableSlotOptions"
          placeholder="Select an available slot"
          clearable
          :disabled="!formValue.serviceId"
        />
      </n-form-item>
      <n-form-item>
        <n-button type="primary" @click="handleSubmit" :loading="loading">
          Book Now
        </n-button>
      </n-form-item>
    </n-form>
    <n-alert v-if="error" type="error" title="Booking Error" :show-icon="false" class="mt-4">
      {{ error }}
    </n-alert>
  </n-card>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import {
  NCard,
  NForm,
  NFormItem,
  NSelect,
  NButton,
  NAlert,
  FormInst,
  FormRules,
  SelectOption,
  useMessage,
} from 'naive-ui';
import { format } from 'date-fns';
import { useBookingStore } from '@/stores/useBookingStore'; // Assuming a booking store
import { useAvailabilityStore } from '@/stores/useAvailabilityStore'; // Assuming an availability store

interface Service {
  id: number;
  name: string;
  description: string;
  durationInMinutes: number;
  price: number;
}

interface AvailabilitySlot {
  id: number;
  startTime: string; // ISO string
  endTime: string; // ISO string
  isBooked: boolean;
}

const props = defineProps<{
  providerId: number;
  availableSlots: AvailabilitySlot[];
  services: Service[];
}>();

const emit = defineEmits<{
  (e: 'submit', { serviceId, availabilitySlotId }: { serviceId: number, availabilitySlotId: number }): void;
  (e: 'success'): void;
  (e: 'error', message: string): void;
}>();

const bookingStore = useBookingStore();
const availabilityStore = useAvailabilityStore();
const message = useMessage(); // For Naive UI message notifications

const formRef = ref<FormInst | null>(null);
const formValue = reactive({
  serviceId: null as number | null,
  availabilitySlotId: null as number | null,
});

const loading = ref(false);
const error = ref<string | null>(null);

const serviceOptions = computed<SelectOption[]>(() => {
  return props.services.map((service) => ({
    label: `${service.name} ($${service.price}, ${service.durationInMinutes}min)`,
    value: service.id,
  }));
});

const availableSlotOptions = computed<SelectOption[]>(() => {
  if (!props.availableSlots || props.availableSlots.length === 0) {
    return [];
  }
  return props.availableSlots
    .filter(slot => !slot.isBooked) // Only show non-booked slots
    .map((slot) => ({
      label: `${format(new Date(slot.startTime), 'MMM d, p')} - ${format(new Date(slot.endTime), 'p')}`,
      value: slot.id,
    }));
});

watch(() => props.availableSlots, (newSlots) => {
  // If selected slot becomes unavailable (e.g., booked by someone else), clear selection
  if (formValue.availabilitySlotId) {
    const isStillAvailable = newSlots.some(slot => slot.id === formValue.availabilitySlotId && !slot.isBooked);
    if (!isStillAvailable) {
      formValue.availabilitySlotId = null;
    }
  }
}, { deep: true });


const rules: FormRules = {
  serviceId: {
    required: true,
    message: 'Please select a service',
    trigger: ['blur', 'change'],
  },
  availabilitySlotId: {
    required: true,
    message: 'Please select an available slot',
    trigger: ['blur', 'change'],
  },
};

const handleSubmit = async () => {
  try {
    await formRef.value?.validate();
    loading.value = true;
    error.value = null;

    if (formValue.serviceId !== null && formValue.availabilitySlotId !== null) {
      // Emit submit event for parent to handle, or handle directly via store
      // For now, let's directly use the store action
      await bookingStore.createBooking({
        customerId: 1, // Placeholder: replace with actual authenticated user ID
        serviceId: formValue.serviceId,
        availabilitySlotId: formValue.availabilitySlotId,
      });

      message.success('Booking created successfully!');
      emit('success');
      // Optionally reset form
      formValue.serviceId = null;
      formValue.availabilitySlotId = null;
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to create booking.';
    message.error(error.value);
    emit('error', error.value);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.mt-4 {
  margin-top: 1rem;
}
</style>
