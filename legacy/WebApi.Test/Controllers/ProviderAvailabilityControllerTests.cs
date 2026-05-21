// WebApi.Test/Controllers/ProviderAvailabilityControllerTests.cs
using Xunit;
using Microsoft.AspNetCore.Mvc.Testing;
using System.Net.Http;
using System.Threading.Tasks;
using WebApi; // Reference to the main WebApi project
using System.Net;
using Newtonsoft.Json;
using System.Text;
using System;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using Moq;
using WebApi.Repositories.UnitOfWork;
using WebApi.Repositories.Base;
using WebApi.Models.Entities;
using Microsoft.AspNetCore.Hosting; // Added for IWebHostBuilder
using System.Linq; // Added for .SingleOrDefault

namespace WebApi.Test.Controllers
{
    public class CustomWebApplicationFactory<TProgram> : WebApplicationFactory<TProgram> where TProgram : class
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.ConfigureServices(services =>
            {
                // Remove the app's ApplicationDbContext registration
                var descriptor = services.SingleOrDefault(
                    d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>));
                if (descriptor != null)
                {
                    services.Remove(descriptor);
                }

                // Add ApplicationDbContext using an in-memory database for testing
                services.AddDbContext<ApplicationDbContext>(options =>
                {
                    options.UseInMemoryDatabase("InMemoryDbForTesting");
                });

                // Build the service provider.
                var sp = services.BuildServiceProvider();

                // Create a scope to obtain a reference to the database contexts
                using (var scope = sp.CreateScope())
                {
                    var scopedServices = scope.ServiceProvider;
                    var db = scopedServices.GetRequiredService<ApplicationDbContext>();
                    // Using a dummy logger for now as NLog is not fully set up in tests
                    var logger = Mock.Of<ILogger<CustomWebApplicationFactory<TProgram>>>();

                    // Ensure the database is created.
                    db.Database.EnsureCreated();

                    try
                    {
                        // Seed the database with test data if needed.
                        // Utilities.InitializeDbForTests(db);
                    }
                    catch (Exception ex)
                    {
                        // Use the dummy logger
                        logger.LogError(ex, "An error occurred seeding the " +
                                            "database with test messages. Error: {Message}", ex.Message);
                    }
                }
            });
        }
    }

    public class ProviderAvailabilityControllerTests : IClassFixture<CustomWebApplicationFactory<Program>>
    {
        private readonly HttpClient _client;
        private readonly CustomWebApplicationFactory<Program> _factory;

        public ProviderAvailabilityControllerTests(CustomWebApplicationFactory<Program> factory)
        {
            _factory = factory;
            _client = factory.CreateClient();
        }

        [Fact]
        public async Task Post_AvailabilitySlots_ReturnsCreated()
        {
            // Arrange
            var slots = new[]
            {
                new { StartTime = DateTime.UtcNow.AddDays(1).ToString("o"), EndTime = DateTime.UtcNow.AddDays(1).AddHours(1).ToString("o") },
                new { StartTime = DateTime.UtcNow.AddDays(2).ToString("o"), EndTime = DateTime.UtcNow.AddDays(2).AddHours(1).ToString("o") }
            };
            var content = new StringContent(JsonConvert.SerializeObject(slots), Encoding.UTF8, "application/json");

            // Act
            var response = await _client.PostAsync("/api/providers/availability", content);

            // Assert
            response.EnsureSuccessStatusCode(); // Status Code 200-299
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            // Additional assertions can be made on the response content if it returns created items
        }

        [Fact]
        public async Task Delete_AvailabilitySlot_ReturnsNoContent()
        {
            // Arrange - First create a slot to delete
            var newSlot = new AvailabilitySlot
            {
                ProviderId = 1, // Assuming a provider exists
                StartTime = DateTime.UtcNow.AddDays(3),
                EndTime = DateTime.UtcNow.AddDays(3).AddHours(1),
                IsBooked = false
            };

            // Using a scoped context to add data directly to the in-memory database
            using (var scope = _factory.Services.CreateScope())
            {
                var scopedServices = scope.ServiceProvider;
                var dbContext = scopedServices.GetRequiredService<ApplicationDbContext>();
                dbContext.Add(newSlot); // Changed from dbContext.AvailabilitySlots.Add(newSlot); as DbSet is not yet defined
                await dbContext.SaveChangesAsync();
            }

            // Act
            var response = await _client.DeleteAsync($"/api/providers/availability/{newSlot.Id}");

            // Assert
            response.EnsureSuccessStatusCode();
            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

            // Verify it's actually deleted
            using (var scope = _factory.Services.CreateScope())
            {
                var scopedServices = scope.ServiceProvider;
                var dbContext = scopedServices.GetRequiredService<ApplicationDbContext>();
                var deletedSlot = await dbContext.FindAsync<AvailabilitySlot>(newSlot.Id); // Changed from dbContext.AvailabilitySlots.FindAsync
                Assert.Null(deletedSlot);
            }
        }
    }
}
