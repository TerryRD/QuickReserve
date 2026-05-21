// WebApp/tests/unit/AddAvailabilityModal.spec.ts
import { mount } from '@vue/test-utils';
import { describe, it, expect, vi } from 'vitest';
import AddAvailabilityModal from '@/components/AddAvailabilityModal.vue'; // Assuming the component path
import { NButton, NForm, NFormItem, NDatePicker } from 'naive-ui'; // Import Naive UI components for mocking

describe('AddAvailabilityModal', () => {
  it('emits "submit" event with correct data on form submission', async () => {
    const wrapper = mount(AddAvailabilityModal, {
      global: {
        components: {
          NButton,
          NForm,
          NFormItem,
          NDatePicker,
        },
      },
    });

    // Simulate user input for start and end times
    // Note: Naive UI's NDatePicker might be complex to simulate directly in unit tests
    // Here we'll directly set the v-model values for simplicity in a mock scenario
    await wrapper.vm.$nextTick(); // Wait for component to update if using v-model
    // Need to find the NDatePicker component first
    const datePicker = wrapper.findComponent(NDatePicker);
    await datePicker.vm.$emit('update:value', [
      new Date('2026-01-20T09:00:00.000Z').getTime(),
      new Date('2026-01-20T10:00:00.000Z').getTime(),
    ]);


    // Find and click the submit button (assuming it's the first NButton)
    const submitButton = wrapper.findComponent(NButton);
    await submitButton.trigger('click');

    // Assert that the "submit" event was emitted with the expected payload
    expect(wrapper.emitted('submit')).toHaveLength(1);
    expect(wrapper.emitted('submit')![0][0]).toEqual({
      startTime: new Date('2026-01-20T09:00:00.000Z'),
      endTime: new Date('2026-01-20T10:00:00.000Z'),
    });
  });

  it('does not emit "submit" if form validation fails', async () => {
    const wrapper = mount(AddAvailabilityModal, {
      global: {
        components: {
          NButton,
          NForm,
          NFormItem,
          NDatePicker,
        },
      },
    });

    // Do not provide any input, so validation should fail
    const submitButton = wrapper.findComponent(NButton);
    await submitButton.trigger('click');

    // Assert that the "submit" event was not emitted
    expect(wrapper.emitted('submit')).toBeUndefined();
  });
});
