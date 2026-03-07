// WebApi/Services/Interfaces/IAdminService.cs
using System.Collections.Generic;
using System.Threading.Tasks;
using WebApi.Models.Entities;

namespace WebApi.Services
{
    public interface IAdminService
    {
        Task<IEnumerable<User>> GetAllUsers();
        Task<IEnumerable<Booking>> GetAllBookings();
    }
}
