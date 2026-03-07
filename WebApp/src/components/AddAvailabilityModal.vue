<!-- WebApp/src/components/AddAvailabilityModal.vue -->
<template>
  <n-modal v-model:show="showModal" preset="dialog" title="Add Availability Slot" :mask-closable="false">
    <n-form
      ref="formRef"
      :model="formValue"
      :rules="rules"
      label-placement="top"
      :show-require-mark="true"
    >
      <n-form-item label="Start and End Time" path="dateTimeRange">
        <n-date-picker
          v-model:value="formValue.dateTimeRange"
          type="datetimerange"
          clearable
          size="large"
          class="w-full"
        />
      </n-form-item>
    </n-form>
    <template #action>
      <n-button @click="handleCancel">Cancel</n-button>
      <n-button type="primary" @click="handleSubmit">Submit</n-button>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { NModal, NForm, NFormItem, NDatePicker, NButton, FormInst, FormRules } from 'naive-ui';

const showModal = defineModel<boolean>('show', { default: false });

const emit = defineEmits<{
  (e: 'submit', { startTime, endTime }: { startTime: Date, endTime: Date }): void;
  (e: 'cancel'): void;
}>();

const formRef = ref<FormInst | null>(null);

const formValue = reactive({
  dateTimeRange: [null, null] as [number | null, number | null],
});

const rules: FormRules = {
  dateTimeRange: {
    validator: (rule, value) => {
      if (!value || value[0] === null || value[1] === null) {
        return new Error('Please select both start and end times.');
      }
      if (value[0] >= value[1]) {
        return new Error('End time must be after start time.');
      }
      return true;
    },
    trigger: ['blur', 'change'],
  },
};

const handleSubmit = async () => {
  try {
    await formRef.value?.validate();
    if (formValue.dateTimeRange[0] !== null && formValue.dateTimeRange[1] !== null) {
      emit('submit', {
        startTime: new Date(formValue.dateTimeRange[0]),
        endTime: new Date(formValue.dateTimeRange[1]),
      });
      showModal.value = false;
    }
  } catch (errors) {
    console.error('Validation failed:', errors);
  }
};

const handleCancel = () => {
  emit('cancel');
  showModal.value = false;
};
</script>

<style scoped>
/* Tailwind CSS utilities for width can be used here */
.w-full {
  width: 100%;
}
</style>
