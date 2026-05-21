// WebApi.Test/Controllers/BookingsControllerTests.cs
using Xunit;
using Microsoft.AspNetCore.Mvc.Testing;
using System.Net.Http;
using System.Threading.Tasks;
using WebApi;
using System.Net;
using Newtonsoft.Json;
using System.Text;
using System;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using WebApi.Models.Entities;
using System.Linq;
using System.Collections.Generic;
using Microsoft.AspNetCore.Hosting; // Added for IWebHostBuilder
using Microsoft.Extensions.Logging; // Added for ILogger in CustomWebApplicationFactory

namespace WebApi.Test.Controllers
{
    public class BookingsControllerTests : IClassFixture<CustomWebApplicationFactory<Program>>
    {
        private readonly HttpClient _client;
        private readonly CustomWebApplicationFactory<Program> _factory;

        public BookingsControllerTests(CustomWebApplicationFactory<Program> factory)
        {
            _factory = factory;
            _client = factory.CreateClient();
        }

        private async Task SeedData(ApplicationDbContext dbContext)
        {
            // Clear existing data
            dbContext.AvailabilitySlots.RemoveRange(dbContext.AvailabilitySlots);
            dbContext.Users.RemoveRange(dbContext.Users);
            dbContext.Services.RemoveRange(dbContext.Services);
            dbContext.Bookings.RemoveRange(dbContext.Bookings);
            await dbContext.SaveChangesAsync();

            // Seed a customer
            var customer = new User
            {
                Id = 1, Name = "Test Customer", Email = "customer@test.com", HashedPassword = "hash", Role = UserRole.Customer,
                CreateTime = DateTime.UtcNow, Updater = "System", Creator = "System", UpdateTime = DateTime.UtcNow
            };
            dbContext.Users.Add(customer);

            // Seed a provider
            var provider = new User
            {
                Id = 2, Name = "Test Provider", Email = "provider@test.com", HashedPassword = "hash", Role = UserRole.Provider,
                CreateTime = DateTime.UtcNow, Updater = "System", Creator = "System", UpdateTime = DateTime.UtcNow
            };
            dbContext.Users.Add(provider);
            
            // Seed a service
            var service = new Service
            {
                Id = 10, Name = "Test Service", Description = "A test service", DurationInMinutes = 60, Price = 50.00M,
                ProviderId = provider.Id, Provider = provider,
                CreateTime = DateTime.UtcNow, Updater = "System", Creator = "System", UpdateTime = DateTime.UtcNow
            };
            dbContext.Services.Add(service);

            // Seed an available slot
            var availableSlot = new AvailabilitySlot
            {
                Id = 100, ProviderId = provider.Id, Provider = provider,
                StartTime = DateTime.UtcNow.AddHours(1), EndTime = DateTime.UtcNow.AddHours(2), IsBooked = false,
                CreateTime = DateTime.UtcNow, Updater = "System", Creator = "System", UpdateTime = DateTime.UtcNow
            };
            dbContext.AvailabilitySlots.Add(availableSlot);

            await dbContext.SaveChangesAsync();
        }

        [Fact]
        public async Task Post_CreateBooking_ReturnsCreated()
        {
            // Arrange
            using (var scope = _factory.Services.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                await SeedData(dbContext);
            }

            var createBookingDto = new
            {
                ServiceId = 10,
                AvailabilitySlotId = 100,
            };
            var content = new StringContent(JsonConvert.SerializeObject(createBookingDto), Encoding.UTF8, "application/json");

            // Act
            // Assuming customerId is passed through a header or auth context, for now hardcoding or passing through DTO
            // For integration test, assume the API handles authentication and gets current user's ID
            var response = await _client.PostAsync("/api/bookings", content);

            // Assert
            response.EnsureSuccessStatusCode();
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);

            // Verify the slot is booked and booking created in DB
            using (var scope = _factory.Services.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var bookedSlot = await dbContext.AvailabilitySlots.FindAsync(100);
                Assert.True(bookedSlot.IsBooked);
                var bookings = await dbContext.Bookings.FirstOrDefaultAsync(b => b.AvailabilitySlotId == 100);
                Assert.NotNull(booking);
                Assert.Equal(BookingStatus.Pending, booking.Status);
            }
        }

        [Fact]
        public async Task Post_CreateBooking_ConcurrentRequestsPreventOverbooking()
        {
            // Arrange
            using (var scope = _factory.Services.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                await SeedData(dbContext); // Ensure clean state and available slot
            }

            var createBookingDto = new
            {
                ServiceId = 10,
                AvailabilitySlotId = 100,
            };
            var content = new StringContent(JsonConvert.SerializeObject(createBookingDto), Encoding.UTF8, "application/json");

            var requests = new List<Task<HttpResponseMessage>>();
            for (int i = 0; i < 5; i++) // Simulate 5 concurrent requests
            {
                // Each request is from a different "customer" for realism, though not strictly necessary for overbooking logic
                var client = _factory.CreateClient(); // New client per request to avoid HttpClient state issues
                requests.Add(client.PostAsync("/api/bookings", content));
            }

            // Act
            var responses = await Task.WhenAll(requests);

            // Assert
            int successCount = 0;
            int conflictCount = 0;

            foreach (var response in responses)
            {
                if (response.StatusCode == HttpStatusCode.Created)
                {
                    successCount++;
                }
                else if (response.StatusCode == HttpStatusCode.BadRequest) // Assuming BadRequest for overbooking
                {
                    conflictCount++;
                }
            }

            Assert.Equal(1, successCount); // Only one booking should succeed
            Assert.Equal(4, conflictCount); // The rest should fail due to overbooking

            // Verify only one booking was created and the slot is booked
            using (var scope = _factory.Services.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var bookedSlot = await dbContext.AvailabilitySlots.FindAsync(100);
                Assert.True(bookedSlot.IsBooked);
                var bookings = await dbContext.Bookings.Where(b => b.AvailabilitySlotId == 100).ToListAsync();
                Assert.Single(bookings);
            }
        }
    }
}
