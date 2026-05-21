// WebApi/Services/BookingService.cs
using WebApi.Models.Entities;
using WebApi.Repositories.Base;
using WebApi.Repositories.UnitOfWork;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace WebApi.Services
{
    public class BookingService : IBookingService
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IBaseRepository<Booking> _bookingRepository;
        private readonly IBaseRepository<AvailabilitySlot> _availabilitySlotRepository;
        private readonly IBaseRepository<User> _userRepository;
        private readonly IBaseRepository<Service> _serviceRepository;

        public BookingService(
            IUnitOfWork unitOfWork,
            IBaseRepository<Booking> bookingRepository,
            IBaseRepository<AvailabilitySlot> availabilitySlotRepository,
            IBaseRepository<User> userRepository,
            IBaseRepository<Service> serviceRepository)
        {
            _unitOfWork = unitOfWork;
            _bookingRepository = bookingRepository;
            _availabilitySlotRepository = availabilitySlotRepository;
            _userRepository = userRepository;
            _serviceRepository = serviceRepository;
        }

        public async Task<Booking> CreateBooking(int customerId, int serviceId, int availabilitySlotId)
        {
            var slot = await _availabilitySlotRepository.GetByIdAsync(availabilitySlotId);
            if (slot == null)
            {
                throw new KeyNotFoundException($"Availability slot with ID {availabilitySlotId} not found.");
            }

            if (slot.IsBooked)
            {
                throw new InvalidOperationException($"Availability slot with ID {availabilitySlotId} is already booked.");
            }

            var customer = await _userRepository.GetByIdAsync(customerId);
            if (customer == null)
            {
                throw new KeyNotFoundException($"Customer with ID {customerId} not found.");
            }

            var service = await _serviceRepository.GetByIdAsync(serviceId);
            if (service == null)
            {
                throw new KeyNotFoundException($"Service with ID {serviceId} not found.");
            }

            // Ensure the service belongs to the provider associated with the slot
            if (service.ProviderId != slot.ProviderId)
            {
                throw new InvalidOperationException("The selected service does not belong to the provider of the availability slot.");
            }
            
            // Mark the slot as booked
            slot.IsBooked = true;
            _availabilitySlotRepository.Update(slot);

            var booking = new Booking
            {
                CustomerId = customerId,
                ProviderId = slot.ProviderId, // Provider from the slot
                ServiceId = serviceId,
                AvailabilitySlotId = availabilitySlotId,
                Status = BookingStatus.Pending, // Initial status
                CreateTime = DateTime.UtcNow,
                UpdateTime = DateTime.UtcNow,
                Creator = customer.Name, // Or from authenticated user
                Updater = customer.Name, // Or from authenticated user
            };

            await _bookingRepository.AddAsync(booking);
            await _unitOfWork.CompleteAsync();

            return booking;
        }
    }
}
