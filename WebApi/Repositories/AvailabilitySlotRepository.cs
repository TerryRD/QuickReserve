// WebApi/Repositories/AvailabilitySlotRepository.cs
using WebApi.Models.Entities;
using WebApi.Repositories.Base;

namespace WebApi.Repositories
{
    public class AvailabilitySlotRepository : BaseRepository<AvailabilitySlot>, IAvailabilitySlotRepository
    {
        public AvailabilitySlotRepository(ApplicationDbContext context) : base(context)
        {
        }

        // Implement specific methods for AvailabilitySlot if needed
    }
}
