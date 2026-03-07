// WebApp/tests/unit/ProviderScheduleCalendar.spec.ts
import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import ProviderScheduleCalendar from '@/components/ProviderScheduleCalendar.vue'; // Assuming the component path

describe('ProviderScheduleCalendar', () => {
  it('renders availability slots correctly', async () => {
    const availabilitySlots = [
      { id: 1, startTime: '2026-01-20T09:00:00Z', endTime: '2026-01-20T10:00:00Z' },
      { id: 2, startTime: '2026-01-20T11:00:00Z', endTime: '2026-01-20T12:00:00Z' },
    ];

    const wrapper = mount(ProviderScheduleCalendar, {
      props: {
        slots: availabilitySlots,
      },
    });

    // Check if the component renders the correct number of slots
    const renderedSlots = wrapper.findAll('.availability-slot'); // Assuming a class for slots
    expect(renderedSlots).toHaveLength(availabilitySlots.length);

    // Check if slot content is rendered correctly (example: start time)
    expect(renderedSlots[0].text()).toContain('09:00');
    expect(renderedSlots[1].text()).toContain('11:00');
  });

  it('emits an event when a slot is clicked', async () => {
    const availabilitySlots = [
      { id: 1, startTime: '2026-01-20T09:00:00Z', endTime: '2026-01-20T10:00:00Z' },
    ];

    const wrapper = mount(ProviderScheduleCalendar, {
      props: {
        slots: availabilitySlots,
      },
    });

    await wrapper.find('.availability-slot').trigger('click'); // Assuming a clickable slot

    expect(wrapper.emitted()).toHaveProperty('slot-clicked');
    expect(wrapper.emitted('slot-clicked')![0]).toEqual([availabilitySlots[0].id]);
  });
});
