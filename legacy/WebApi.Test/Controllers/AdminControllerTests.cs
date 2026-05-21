// WebApi.Test/Controllers/AdminControllerTests.cs
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
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;
using System.Security.Claims;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.Authentication;

namespace WebApi.Test.Controllers
{
    // Custom factory for Admin tests to mock authentication
    public class AdminTestWebApplicationFactory<TProgram> : WebApplicationFactory<TProgram> where TProgram : class
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.ConfigureTestServices(services =>
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
                    options.UseInMemoryDatabase("InMemoryDbForTestingAdmin");
                });

                // Mock authentication for admin tests
                services.AddAuthentication("Test")
                    .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("Test", options => { });

                // Build the service provider.
                var sp = services.BuildServiceProvider();

                using (var scope = sp.CreateScope())
                {
                    var scopedServices = scope.ServiceProvider;
                    var db = scopedServices.GetRequiredService<ApplicationDbContext>();
                    db.Database.EnsureCreated();
                }
            });
        }
    }

    public class AdminControllerTests : IClassFixture<AdminTestWebApplicationFactory<Program>>
    {
        private readonly HttpClient _client;
        private readonly AdminTestWebApplicationFactory<Program> _factory;

        public AdminControllerTests(AdminTestWebApplicationFactory<Program> factory)
        {
            _factory = factory;
            _client = factory.CreateClient(new WebApplicationFactoryClientOptions
            {
                AllowAutoRedirect = false // Prevent automatic redirects on unauthorized requests
            });
        }

        private HttpClient CreateAuthenticatedClient(UserRole role)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, "1"),
                new Claim(ClaimTypes.Name, "TestUser"),
                new Claim(ClaimTypes.Role, role.ToString())
            };
            var identity = new ClaimsIdentity(claims, "Test");
            var principal = new ClaimsPrincipal(identity);

            return _factory.WithWebHostBuilder(builder =>
            {
                builder.ConfigureTestServices(services =>
                {
                    services.AddAuthentication("Test")
                        .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("Test", options => { });
                    services.AddAuthorization(options =>
                    {
                        options.AddPolicy("Admin", policy => policy.RequireRole(UserRole.Admin.ToString()));
                    });
                });
            }).CreateClient(new WebApplicationFactoryClientOptions
            {
                AllowAutoRedirect = false
            });
        }

        [Fact]
        public async Task Get_AdminUsers_ReturnsUnauthorized_ForNonAdmin()
        {
            // Arrange
            var client = CreateAuthenticatedClient(UserRole.Customer); // Authenticate as a customer

            // Act
            var response = await client.GetAsync("/api/admin/users");

            // Assert
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Get_AdminUsers_ReturnsOk_ForAdmin()
        {
            // Arrange
            var client = CreateAuthenticatedClient(UserRole.Admin); // Authenticate as an admin
            using (var scope = _factory.Services.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                await SeedData(dbContext); // Ensure some test users exist
            }

            // Act
            var response = await client.GetAsync("/api/admin/users");

            // Assert
            response.EnsureSuccessStatusCode();
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var users = JsonConvert.DeserializeObject<List<User>>(await response.Content.ReadAsStringAsync());
            Assert.NotNull(users);
            Assert.True(users.Any());
        }

        // Helper to seed data (similar to BookingsControllerTests)
        private async Task SeedData(ApplicationDbContext dbContext)
        {
            // Clear existing data
            dbContext.Users.RemoveRange(dbContext.Users);
            await dbContext.SaveChangesAsync();

            dbContext.Users.Add(new User
            {
                Id = 1, Name = "Admin User", Email = "admin@test.com", HashedPassword = "hash", Role = UserRole.Admin,
                CreateTime = DateTime.UtcNow, Updater = "System", Creator = "System", UpdateTime = DateTime.UtcNow
            });
            dbContext.Users.Add(new User
            {
                Id = 2, Name = "Customer User", Email = "customer@test.com", HashedPassword = "hash", Role = UserRole.Customer,
                CreateTime = DateTime.UtcNow, Updater = "System", Creator = "System", UpdateTime = DateTime.UtcNow
            });
            await dbContext.SaveChangesAsync();
        }
    }

    // Dummy TestAuthHandler for mocking authentication
    public class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public TestAuthHandler(Microsoft.Extensions.Options.IOptionsMonitor<AuthenticationSchemeOptions> options,
            ILoggerFactory logger, System.Text.Encodings.Web.UrlEncoder encoder, ISystemClock clock)
            : base(options, logger, encoder, clock)
        {
        }

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var claimsPrincipal = new ClaimsPrincipal(Scheme.Name);
            var claimsIdentity = new ClaimsIdentity(Scheme.Name);

            if (Context.User.Identity is ClaimsIdentity existingIdentity && existingIdentity.IsAuthenticated)
            {
                // Use existing identity if already authenticated (e.g., from CreateAuthenticatedClient)
                claimsPrincipal = Context.User;
            }
            else if (Request.Headers.ContainsKey("X-Test-Role"))
            {
                // If a test role is provided in the header, create an identity with that role
                var role = Request.Headers["X-Test-Role"].ToString();
                claimsIdentity.AddClaim(new Claim(ClaimTypes.Role, role));
                claimsIdentity.AddClaim(new Claim(ClaimTypes.NameIdentifier, "TestUser123")); // Dummy ID
                claimsIdentity.AddClaim(new Claim(ClaimTypes.Name, "TestUser"));
                claimsPrincipal = new ClaimsPrincipal(claimsIdentity);
            }
            else
            {
                // Default unauthenticated
                return Task.FromResult(AuthenticateResult.Fail("Unauthorized"));
            }

            var ticket = new AuthenticationTicket(claimsPrincipal, Scheme.Name);
            return Task.FromResult(AuthenticateResult.Success(ticket));
        }
    }
}
