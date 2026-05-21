// WebApi/ApplicationDbContext.cs
using Microsoft.EntityFrameworkCore;
using WebApi.Models.Entities; // Assuming entities will be here

namespace WebApi
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        // Add DbSets for entities
        public DbSet<User> Users { get; set; }
        public DbSet<Service> Services { get; set; }
        public DbSet<AvailabilitySlot> AvailabilitySlots { get; set; }
        public DbSet<Booking> Bookings { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            // Configure relationships and constraints here
        }
    }
}
