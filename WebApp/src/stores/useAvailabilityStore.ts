// WebApp/src/stores/useAvailabilityStore.ts
import { defineStore } from 'pinia';
import { createAvailabilitySlots, deleteAvailabilitySlot } from '@/api/availability'; // Import API functions

interface AvailabilitySlot {
  id: number;
  startTime: string;
  endTime: string;
}

interface AvailabilityState {
  availabilitySlots: AvailabilitySlot[];
  loading: boolean;
  error: string | null;
}

export const useAvailabilityStore = defineStore('availability', {
  state: (): AvailabilityState => ({
    availabilitySlots: [],
    loading: false,
    error: null,
  }),
  getters: {
    getAvailabilitySlots: (state) => state.availabilitySlots,
    isLoading: (state) => state.loading,
    getError: (state) => state.error,
  },
  actions: {
    async fetchAvailabilitySlots() {
      this.loading = true;
      this.error = null;
      try {
        // TODO: Implement actual API call to fetch slots for a provider
        // For now, return dummy data
        this.availabilitySlots = [
            { id: 101, startTime: new Date().toISOString(), endTime: new Date(Date.now() + 3600000).toISOString() },
            { id: 102, startTime: new Date(Date.now() + 7200000).toISOString(), endTime: new Date(Date.now() + 10800000).toISOString() },
        ];
      } catch (err: any) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

    async addAvailabilitySlots(slots: { startTime: Date; endTime: Date }[]) {
      this.loading = true;
      this.error = null;
      try {
        const newSlots = slots.map(slot => ({
          startTime: slot.startTime.toISOString(),
          endTime: slot.endTime.toISOString(),
        }));
        const created = await createAvailabilitySlots(newSlots);
        this.availabilitySlots.push(...created);
      } catch (err: any) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

    async removeAvailabilitySlot(slotId: number) {
      this.loading = true;
      this.error = null;
      try {
        await deleteAvailabilitySlot(slotId);
        this.availabilitySlots = this.availabilitySlots.filter(slot => slot.id !== slotId);
      } catch (err: any) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },
  },
});
