// WebApi/Services/AdminService.cs
using System.Collections.Generic;
using System.Threading.Tasks;
using WebApi.Models.Entities;
using WebApi.Repositories.Base;
using Microsoft.EntityFrameworkCore; // For Include

namespace WebApi.Services
{
    public class AdminService : IAdminService
    {
        private readonly IBaseRepository<User> _userRepository;
        private readonly IBaseRepository<Booking> _bookingRepository;

        public AdminService(IBaseRepository<User> userRepository, IBaseRepository<Booking> bookingRepository)
        {
            _userRepository = userRepository;
            _bookingRepository = bookingRepository;
        }

        public async Task<IEnumerable<User>> GetAllUsers()
        {
            return await _userRepository.GetAllAsync();
        }

        public async Task<IEnumerable<Booking>> GetAllBookings()
        {
            // Eager load related entities for AdminBookingDto mapping
            // This is a simplified approach, a dedicated query for DTOs would be better for performance
            return await ((IQueryable<Booking>)_bookingRepository).Include(b => b.Customer)
                                                                 .Include(b => b.Provider)
                                                                 .Include(b => b.Service)
                                                                 .Include(b => b.AvailabilitySlot)
                                                                 .ToListAsync();
        }
    }
}
