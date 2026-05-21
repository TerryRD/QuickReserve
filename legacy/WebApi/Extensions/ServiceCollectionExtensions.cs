// WebApi/Extensions/ServiceCollectionExtensions.cs
using Microsoft.EntityFrameworkCore;
using WebApi.Repositories.Base;
using WebApi.Repositories.UnitOfWork;
using WebApi; // For ApplicationDbContext
using WebApi.Repositories; // Added for specific repositories
using WebApi.Services; // Added for specific services

namespace Microsoft.Extensions.DependencyInjection
{
    public static class ServiceCollectionExtensions
    {
        public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
        {
            // Register generic repository
            services.AddScoped(typeof(IBaseRepository<>), typeof(BaseRepository<>));

            // Register specific repositories
            services.AddScoped<IAvailabilitySlotRepository, AvailabilitySlotRepository>();
            services.AddScoped<IServiceRepository, ServiceRepository>();
            services.AddScoped<IBookingRepository, BookingRepository>();

            // Register Unit of Work
            services.AddScoped<IUnitOfWork, UnitOfWork>();

            // Register Services
            services.AddScoped<IAvailabilityService, AvailabilityService>();
            services.AddScoped<IBookingService, BookingService>();
            services.AddScoped<IAdminService, AdminService>();

            return services;
        }
    }
}
