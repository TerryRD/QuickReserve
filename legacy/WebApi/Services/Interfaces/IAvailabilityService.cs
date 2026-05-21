// WebApi/Services/Interfaces/IAvailabilityService.cs
using WebApi.Models.Entities;

namespace WebApi.Services
{
    public interface IAvailabilityService
    {
        Task<AvailabilitySlot> CreateAvailabilitySlot(AvailabilitySlot slot);
        Task DeleteAvailabilitySlot(int slotId);
    }
}
