// WebApp/src/stores/useBookingStore.ts
import { defineStore } from 'pinia';
import { createBooking, fetchMyBookings } from '@/api/booking'; // Import API functions

interface CreateBookingPayload {
  customerId: number;
  serviceId: number;
  availabilitySlotId: number;
}

interface BookingDetails {
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
}

interface BookingState {
  myBookings: BookingDetails[];
  loading: boolean;
  error: string | null;
}

export const useBookingStore = defineStore('booking', {
  state: (): BookingState => ({
    myBookings: [],
    loading: false,
    error: null,
  }),
  getters: {
    getMyBookings: (state) => state.myBookings,
    isLoading: (state) => state.loading,
    getError: (state) => state.error,
  },
  actions: {
    async createBooking(payload: CreateBookingPayload) {
      this.loading = true;
      this.error = null;
      try {
        const newBooking = await createBooking(payload);
        // Optionally update myBookings if the new booking is for the current user
        // this.myBookings.push(newBooking);
        return newBooking;
      } catch (err: any) {
        this.error = err.response?.data?.detail || err.message;
        throw err; // Re-throw to propagate the error
      } finally {
        this.loading = false;
      }
    },

    async loadMyBookings(customerId: number) {
      this.loading = true;
      this.error = null;
      try {
        this.myBookings = await fetchMyBookings(customerId);
      } catch (err: any) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },
  },
});
