// WebApp/src/api/booking.ts
import apiClient from './apiClient';

interface CreateBookingDto {
  serviceId: number;
  availabilitySlotId: number;
}

interface BookingDetailsDto {
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

export const createBooking = async (bookingData: CreateBookingDto): Promise<BookingDetailsDto> => {
  const response = await apiClient.post<BookingDetailsDto>('/api/bookings', bookingData);
  return response.data;
};

export const fetchMyBookings = async (customerId: number): Promise<BookingDetailsDto[]> => {
  // TODO: Implement API call to fetch bookings for a specific customer
  // For now, return dummy data
  return [
    {
      id: 1,
      customerId: customerId,
      customerName: 'Test Customer',
      providerId: 1,
      providerName: 'Test Provider',
      serviceId: 10,
      serviceName: 'Test Service',
      slotStartTime: new Date().toISOString(),
      slotEndTime: new Date(Date.now() + 3600000).toISOString(),
      status: 'Confirmed',
    },
  ];
};

// Add other booking-related API calls as needed
