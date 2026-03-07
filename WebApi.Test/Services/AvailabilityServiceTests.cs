// WebApi.Test/Services/AvailabilityServiceTests.cs
using Xunit;
using Moq; // Assuming Moq for mocking
using System.Threading.Tasks;
using WebApi.Repositories.UnitOfWork;
using WebApi.Repositories.Base;
using WebApi.Models.Entities;
using WebApi.Services; // Assuming AvailabilityService will be in WebApi.Services
using System;
using System.Linq.Expressions;
using System.Collections.Generic;
using System.Linq;

namespace WebApi.Test.Services
{
    public class AvailabilityServiceTests
    {
        private readonly Mock<IUnitOfWork> _unitOfWorkMock;
        private readonly Mock<IBaseRepository<AvailabilitySlot>> _availabilitySlotRepositoryMock;
        private readonly AvailabilityService _availabilityService;

        public AvailabilityServiceTests()
        {
            _unitOfWorkMock = new Mock<IUnitOfWork>();
            _availabilitySlotRepositoryMock = new Mock<IBaseRepository<AvailabilitySlot>>();

            // Setup the UnitOfWork to return the mocked repository
            // This part might need adjustment depending on how IUnitOfWork exposes repositories
            // For now, let's assume direct injection or a way to access it
            // _unitOfWorkMock.Setup(uow => uow.AvailabilitySlots).Returns(_availabilitySlotRepositoryMock.Object);

            _availabilityService = new AvailabilityService(
                _unitOfWorkMock.Object,
                _availabilitySlotRepositoryMock.Object // Assuming direct injection for simplicity in test
            );
        }

        [Fact]
        public async Task CreateAvailabilitySlot_ValidData_ReturnsSuccess()
        {
            // Arrange
            var newSlot = new AvailabilitySlot
            {
                ProviderId = 1,
                StartTime = DateTime.UtcNow.AddHours(1),
                EndTime = DateTime.UtcNow.AddHours(2),
                IsBooked = false
            };

            _availabilitySlotRepositoryMock.Setup(repo => repo.AddAsync(It.IsAny<AvailabilitySlot>()))
                .Returns(Task.CompletedTask);
            _unitOfWorkMock.Setup(uow => uow.CompleteAsync()).ReturnsAsync(1); // One change saved
            _availabilitySlotRepositoryMock.Setup(repo => repo.FindAsync(It.IsAny<Expression<Func<AvailabilitySlot, bool>>>()))
                .ReturnsAsync(new List<AvailabilitySlot>()); // No overlapping slots

            // Act
            var result = await _availabilityService.CreateAvailabilitySlot(newSlot); // This method will be created later

            // Assert
            _availabilitySlotRepositoryMock.Verify(repo => repo.AddAsync(It.IsAny<AvailabilitySlot>()), Times.Once);
            _unitOfWorkMock.Verify(uow => uow.CompleteAsync(), Times.Once);
            Assert.NotNull(result);
            Assert.Equal(newSlot, result);
        }

        [Fact]
        public async Task DeleteAvailabilitySlot_ExistingId_ReturnsSuccess()
        {
            // Arrange
            var existingSlotId = 1;
            var existingSlot = new AvailabilitySlot { Id = existingSlotId, ProviderId = 1, StartTime = DateTime.UtcNow.AddHours(-2), EndTime = DateTime.UtcNow.AddHours(-1) };

            _availabilitySlotRepositoryMock.Setup(repo => repo.GetByIdAsync(existingSlotId)).ReturnsAsync(existingSlot);
            _availabilitySlotRepositoryMock.Setup(repo => repo.Remove(It.IsAny<AvailabilitySlot>()));
            _unitOfWorkMock.Setup(uow => uow.CompleteAsync()).ReturnsAsync(1);

            // Act
            await _availabilityService.DeleteAvailabilitySlot(existingSlotId); // This method will be created later

            // Assert
            _availabilitySlotRepositoryMock.Verify(repo => repo.GetByIdAsync(existingSlotId), Times.Once);
            _availabilitySlotRepositoryMock.Verify(repo => repo.Remove(existingSlot), Times.Once);
            _unitOfWorkMock.Verify(uow => uow.CompleteAsync(), Times.Once);
        }

        [Fact]
        public async Task CreateAvailabilitySlot_OverlappingTime_ThrowsInvalidOperationException()
        {
            // Arrange
            var newSlot = new AvailabilitySlot
            {
                ProviderId = 1,
                StartTime = DateTime.UtcNow.AddHours(1),
                EndTime = DateTime.UtcNow.AddHours(3),
                IsBooked = false
            };
            var existingOverlappingSlot = new AvailabilitySlot
            {
                ProviderId = 1,
                StartTime = DateTime.UtcNow.AddHours(0.5),
                EndTime = DateTime.UtcNow.AddHours(2.5),
                IsBooked = false
            };

            _availabilitySlotRepositoryMock.Setup(repo => repo.FindAsync(It.IsAny<Expression<Func<AvailabilitySlot, bool>>>()))
                .ReturnsAsync(new List<AvailabilitySlot> { existingOverlappingSlot });

            // Act & Assert
            await Assert.ThrowsAsync<InvalidOperationException>(() => _availabilityService.CreateAvailabilitySlot(newSlot));
            _availabilitySlotRepositoryMock.Verify(repo => repo.AddAsync(It.IsAny<AvailabilitySlot>()), Times.Never);
            _unitOfWorkMock.Verify(uow => uow.CompleteAsync(), Times.Never);
        }
    }
}
