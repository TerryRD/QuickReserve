// WebApi/Services/Interfaces/IBookingService.cs
using WebApi.Models.Entities;

namespace WebApi.Services
{
    public interface IBookingService
    {
        Task<Booking> CreateBooking(int customerId, int serviceId, int availabilitySlotId);
        // Add other booking-related methods as needed
    }
}
