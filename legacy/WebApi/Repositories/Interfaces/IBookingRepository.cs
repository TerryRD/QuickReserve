// WebApi/Repositories/Interfaces/IBookingRepository.cs
using WebApi.Models.Entities;
using WebApi.Repositories.Base;

namespace WebApi.Repositories
{
    public interface IBookingRepository : IBaseRepository<Booking>
    {
        // Add specific methods for Booking if needed
    }
}
