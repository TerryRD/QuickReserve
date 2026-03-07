// WebApi/Repositories/ServiceRepository.cs
using WebApi.Models.Entities;
using WebApi.Repositories.Base;

namespace WebApi.Repositories
{
    public class ServiceRepository : BaseRepository<Service>, IServiceRepository
    {
        public ServiceRepository(ApplicationDbContext context) : base(context)
        {
        }

        // Implement specific methods for Service if needed
    }
}
