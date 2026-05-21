<!-- WebApp/src/components/ProviderScheduleCalendar.vue -->
<template>
  <n-card title="Availability Schedule">
    <n-calendar
      #="{ year, month, date }"
      :is-date-disabled="isDateDisabled"
      @update:value="handleUpdateValue"
    >
      <template #default="{ year, month, date }">
        <div class="calendar-day">
          <div class="date-number">{{ date }}</div>
          <div class="slots-container">
            <template v-for="slot in getSlotsForDate(year, month, date)" :key="slot.id">
              <n-tag
                type="info"
                :bordered="false"
                size="small"
                class="availability-slot"
                @click="emit('slot-clicked', slot.id)"
              >
                {{ formatTime(slot.startTime) }} - {{ formatTime(slot.endTime) }}
              </n-tag>
            </template>
          </div>
        </div>
      </template>
    </n-calendar>
  </n-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { NCard, NCalendar, NTag } from 'naive-ui';
import type { CalendarProps } from 'naive-ui';
import { format } from 'date-fns';

interface AvailabilitySlot {
  id: number;
  startTime: string; // ISO string
  endTime: string; // ISO string
}

const props = defineProps<{
  slots: AvailabilitySlot[];
}>();

const emit = defineEmits<{
  (e: 'slot-clicked', id: number): void;
}>();

const selectedDate = ref<number | null>(null);

const handleUpdateValue: CalendarProps['onUpdateValue'] = (value) => {
  selectedDate.value = value;
};

const getSlotsForDate = (year: number, month: number, date: number) => {
  const targetDate = new Date(year, month - 1, date); // month is 1-indexed in Naive UI
  return props.slots.filter(slot => {
    const slotStartTime = new Date(slot.startTime);
    return slotStartTime.getFullYear() === targetDate.getFullYear() &&
           slotStartTime.getMonth() === targetDate.getMonth() &&
           slotStartTime.getDate() === targetDate.getDate();
  });
};

const formatTime = (isoString: string) => {
  return format(new Date(isoString), 'HH:mm');
};

const isDateDisabled: CalendarProps['isDateDisabled'] = (currentDate) => {
  // Example: disable past dates
  return currentDate < Date.now();
};
</script>

<style scoped>
.calendar-day {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 4px;
  box-sizing: border-box;
}

.date-number {
  font-weight: bold;
  font-size: 1.1em;
}

.slots-container {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
}

.availability-slot {
  cursor: pointer;
  width: 100%;
  text-align: center;
}
</style>
