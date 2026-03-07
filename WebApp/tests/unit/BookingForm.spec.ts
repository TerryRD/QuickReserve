// WebApp/tests/unit/BookingForm.spec.ts
import { mount } from '@vue/test-utils';
import { describe, it, expect, vi } from 'vitest';
import BookingForm from '@/components/BookingForm.vue'; // Assuming the component path
import { NButton, NForm, NFormItem, NSelect } from 'naive-ui'; // Import Naive UI components for mocking

// Mock Pinia store (example, actual implementation might vary)
const mockUseBookingStore = vi.fn(() => ({
  createBooking: vi.fn(),
  loading: false,
  error: null,
}));

vi.mock('@/stores/useBookingStore', () => ({
  useBookingStore: mockUseBookingStore,
}));

describe('BookingForm', () => {
  it('emits "submit" event with correct data on form submission', async () => {
    const wrapper = mount(BookingForm, {
      global: {
        components: {
          NButton,
          NForm,
          NFormItem,
          NSelect,
        },
      },
      props: {
        providerId: 1,
        availableSlots: [
          { id: 1, startTime: '2026-01-20T09:00:00Z', endTime: '2026-01-20T10:00:00Z', isBooked: false },
        ],
        services: [
          { id: 10, name: 'Test Service', description: 'desc', durationInMinutes: 60, price: 50 },
        ],
      },
    });

    // Select a service
    const serviceSelect = wrapper.findComponent(NSelect);
    await serviceSelect.setValue(10); // Select service with ID 10

    // Select an availability slot
    const slotSelect = wrapper.findAllComponents(NSelect)[1]; // Assuming second NSelect is for slots
    await slotSelect.setValue(1); // Select slot with ID 1

    // Find and click the submit button
    const submitButton = wrapper.findComponent(NButton);
    await submitButton.trigger('click');

    // Assert that the "submit" event was emitted with the expected payload
    expect(wrapper.emitted('submit')).toHaveLength(1);
    expect(wrapper.emitted('submit')![0][0]).toEqual({
      serviceId: 10,
      availabilitySlotId: 1,
    });
  });

  it('does not emit "submit" if form validation fails (no slot selected)', async () => {
    const wrapper = mount(BookingForm, {
      global: {
        components: {
          NButton,
          NForm,
          NFormItem,
          NSelect,
        },
      },
      props: {
        providerId: 1,
        availableSlots: [], // No available slots
        services: [
          { id: 10, name: 'Test Service', description: 'desc', durationInMinutes: 60, price: 50 },
        ],
      },
    });

    // Select a service (but no slot can be selected)
    const serviceSelect = wrapper.findComponent(NSelect);
    await serviceSelect.setValue(10);

    const submitButton = wrapper.findComponent(NButton);
    await submitButton.trigger('click');

    // Assert that the "submit" event was not emitted
    expect(wrapper.emitted('submit')).toBeUndefined();
  });
});
