// WebApi/Repositories/BookingRepository.cs
using WebApi.Models.Entities;
using WebApi.Repositories.Base;

namespace WebApi.Repositories
{
    public class BookingRepository : BaseRepository<Booking>, IBookingRepository
    {
        public BookingRepository(ApplicationDbContext context) : base(context)
        {
        }

        // Implement specific methods for Booking if needed
    }
}
