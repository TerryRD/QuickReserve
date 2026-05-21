// WebApi/Repositories/UnitOfWork/IUnitOfWork.cs
namespace WebApi.Repositories.UnitOfWork
{
    public interface IUnitOfWork : IDisposable
    {
        // TODO: Add specific repositories here as properties, e.g., IUserRepository Users { get; }
        Task<int> CompleteAsync();
    }
}
