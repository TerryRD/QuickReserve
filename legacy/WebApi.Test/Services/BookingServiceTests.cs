// WebApi.Test/Services/BookingServiceTests.cs
using Xunit;
using Moq;
using System.Threading.Tasks;
using WebApi.Repositories.UnitOfWork;
using WebApi.Repositories.Base;
using WebApi.Models.Entities;
using WebApi.Services;
using System;
using System.Linq.Expressions;
using System.Collections.Generic;
using System.Linq;

namespace WebApi.Test.Services
{
    public class BookingServiceTests
    {
        private readonly Mock<IUnitOfWork> _unitOfWorkMock;
        private readonly Mock<IBaseRepository<Booking>> _bookingRepositoryMock;
        private readonly Mock<IBaseRepository<AvailabilitySlot>> _availabilitySlotRepositoryMock;
        private readonly Mock<IBaseRepository<User>> _userRepositoryMock; // Assuming User entity
        private readonly Mock<IBaseRepository<Service>> _serviceRepositoryMock; // Assuming Service entity
        private readonly BookingService _bookingService;

        public BookingServiceTests()
        {
            _unitOfWorkMock = new Mock<IUnitOfWork>();
            _bookingRepositoryMock = new Mock<IBaseRepository<Booking>>();
            _availabilitySlotRepositoryMock = new Mock<IBaseRepository<AvailabilitySlot>>();
            _userRepositoryMock = new Mock<IBaseRepository<User>>();
            _serviceRepositoryMock = new Mock<IBaseRepository<Service>>();

            _bookingService = new BookingService(
                _unitOfWorkMock.Object,
                _bookingRepositoryMock.Object,
                _availabilitySlotRepositoryMock.Object,
                _userRepositoryMock.Object,
                _serviceRepositoryMock.Object
            );
        }

        [Fact]
        public async Task CreateBooking_AvailableSlot_ReturnsBooking()
        {
            // Arrange
            var customerId = 1;
            var providerId = 2;
            var serviceId = 10;
            var availabilitySlotId = 100;

            var availableSlot = new AvailabilitySlot
            {
                Id = availabilitySlotId,
                ProviderId = providerId,
                StartTime = DateTime.UtcNow.AddHours(1),
                EndTime = DateTime.UtcNow.AddHours(2),
                IsBooked = false,
                Creator = "System",
                Updater = "System",
                CreateTime = DateTime.UtcNow,
                UpdateTime = DateTime.UtcNow
            };
            var customer = new User { Id = customerId, Name = "Customer", Role = UserRole.Customer, Email = "customer@example.com", HashedPassword = "hash", CreateTime = DateTime.UtcNow, Updater = "System", Creator = "System", UpdateTime = DateTime.UtcNow };
            var provider = new User { Id = providerId, Name = "Provider", Role = UserRole.Provider, Email = "provider@example.com", HashedPassword = "hash", CreateTime = DateTime.UtcNow, Updater = "System", Creator = "System", UpdateTime = DateTime.UtcNow };
            var service = new Service { Id = serviceId, Name = "Consultation", ProviderId = providerId, DurationInMinutes = 60, Price = 100, Creator = "System", Updater = "System", CreateTime = DateTime.UtcNow, UpdateTime = DateTime.UtcNow };


            _availabilitySlotRepositoryMock.Setup(repo => repo.GetByIdAsync(availabilitySlotId))
                .ReturnsAsync(availableSlot);
            _userRepositoryMock.Setup(repo => repo.GetByIdAsync(customerId)).ReturnsAsync(customer);
            _userRepositoryMock.Setup(repo => repo.GetByIdAsync(providerId)).ReturnsAsync(provider);
            _serviceRepositoryMock.Setup(repo => repo.GetByIdAsync(serviceId)).ReturnsAsync(service);


            _bookingRepositoryMock.Setup(repo => repo.AddAsync(It.IsAny<Booking>()))
                .Returns(Task.CompletedTask);
            _unitOfWorkMock.Setup(uow => uow.CompleteAsync()).ReturnsAsync(1);

            // Act
            var result = await _bookingService.CreateBooking(customerId, serviceId, availabilitySlotId);

            // Assert
            _availabilitySlotRepositoryMock.Verify(repo => repo.GetByIdAsync(availabilitySlotId), Times.Once);
            _availabilitySlotRepositoryMock.Verify(repo => repo.Update(It.Is<AvailabilitySlot>(s => s.Id == availabilitySlotId && s.IsBooked == true)), Times.Once);
            _bookingRepositoryMock.Verify(repo => repo.AddAsync(It.IsAny<Booking>()), Times.Once);
            _unitOfWorkMock.Verify(uow => uow.CompleteAsync(), Times.Once);
            Assert.NotNull(result);
            Assert.Equal(customerId, result.CustomerId);
            Assert.Equal(serviceId, result.ServiceId);
            Assert.Equal(availabilitySlotId, result.AvailabilitySlotId);
            Assert.Equal(BookingStatus.Pending, result.Status);
        }

        [Fact]
        public async Task CreateBooking_AlreadyBookedSlot_ThrowsInvalidOperationException()
        {
            // Arrange
            var customerId = 1;
            var serviceId = 10;
            var availabilitySlotId = 100;

            var bookedSlot = new AvailabilitySlot
            {
                Id = availabilitySlotId,
                ProviderId = 2,
                StartTime = DateTime.UtcNow.AddHours(1),
                EndTime = DateTime.UtcNow.AddHours(2),
                IsBooked = true, // Already booked
                Creator = "System",
                Updater = "System",
                CreateTime = DateTime.UtcNow,
                UpdateTime = DateTime.UtcNow
            };
            var customer = new User { Id = customerId, Name = "Customer", Role = UserRole.Customer, Email = "customer@example.com", HashedPassword = "hash", CreateTime = DateTime.UtcNow, Updater = "System", Creator = "System", UpdateTime = DateTime.UtcNow };
            var service = new Service { Id = serviceId, Name = "Consultation", ProviderId = 2, DurationInMinutes = 60, Price = 100, Creator = "System", Updater = "System", CreateTime = DateTime.UtcNow, UpdateTime = DateTime.UtcNow };

            _availabilitySlotRepositoryMock.Setup(repo => repo.GetByIdAsync(availabilitySlotId))
                .ReturnsAsync(bookedSlot);
            _userRepositoryMock.Setup(repo => repo.GetByIdAsync(customerId)).ReturnsAsync(customer);
            _serviceRepositoryMock.Setup(repo => repo.GetByIdAsync(serviceId)).ReturnsAsync(service);


            // Act & Assert
            await Assert.ThrowsAsync<InvalidOperationException>(() => _bookingService.CreateBooking(customerId, serviceId, availabilitySlotId));
            _bookingRepositoryMock.Verify(repo => repo.AddAsync(It.IsAny<Booking>()), Times.Never);
            _unitOfWorkMock.Verify(uow => uow.CompleteAsync(), Times.Never);
        }

        [Fact]
        public async Task CreateBooking_SlotNotFound_ThrowsKeyNotFoundException()
        {
            // Arrange
            var customerId = 1;
            var serviceId = 10;
            var availabilitySlotId = 999; // Non-existent

            var customer = new User { Id = customerId, Name = "Customer", Role = UserRole.Customer, Email = "customer@example.com", HashedPassword = "hash", CreateTime = DateTime.UtcNow, Updater = "System", Creator = "System", UpdateTime = DateTime.UtcNow };
            var service = new Service { Id = serviceId, Name = "Consultation", ProviderId = 2, DurationInMinutes = 60, Price = 100, Creator = "System", Updater = "System", CreateTime = DateTime.UtcNow, UpdateTime = DateTime.UtcNow };


            _availabilitySlotRepositoryMock.Setup(repo => repo.GetByIdAsync(availabilitySlotId))
                .ReturnsAsync((AvailabilitySlot)null);
            _userRepositoryMock.Setup(repo => repo.GetByIdAsync(customerId)).ReturnsAsync(customer);
            _serviceRepositoryMock.Setup(repo => repo.GetByIdAsync(serviceId)).ReturnsAsync(service);


            // Act & Assert
            await Assert.ThrowsAsync<KeyNotFoundException>(() => _bookingService.CreateBooking(customerId, serviceId, availabilitySlotId));
            _bookingRepositoryMock.Verify(repo => repo.AddAsync(It.IsAny<Booking>()), Times.Never);
            _unitOfWorkMock.Verify(uow => uow.CompleteAsync(), Times.Never);
        }
    }
}
