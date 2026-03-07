// WebApi/Repositories/Interfaces/IServiceRepository.cs
using WebApi.Models.Entities;
using WebApi.Repositories.Base;

namespace WebApi.Repositories
{
    public interface IServiceRepository : IBaseRepository<Service>
    {
        // Add specific methods for Service if needed
    }
}
