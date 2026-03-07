// WebApp/src/api/availability.ts
import apiClient from './apiClient';

interface AvailabilitySlotDto {
  id?: number; // Optional for creation
  startTime: string;
  endTime: string;
}

export const createAvailabilitySlots = async (slots: AvailabilitySlotDto[]): Promise<AvailabilitySlotDto[]> => {
  const response = await apiClient.post<AvailabilitySlotDto[]>('/api/providers/availability', slots);
  return response.data;
};

export const deleteAvailabilitySlot = async (slotId: number): Promise<void> => {
  await apiClient.delete(`/api/providers/availability/${slotId}`);
};

// Add other availability-related API calls as needed
