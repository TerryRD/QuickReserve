// WebApi/Services/AvailabilityService.cs
using WebApi.Models.Entities;
using WebApi.Repositories.Base;
using WebApi.Repositories.UnitOfWork;
using System.Linq.Expressions;
using System.Collections.Generic; // Added for KeyNotFoundException
using System; // Added for InvalidOperationException
using System.Linq; // Added for .Any()

namespace WebApi.Services
{
    public class AvailabilityService : IAvailabilityService
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IBaseRepository<AvailabilitySlot> _availabilitySlotRepository;

        public AvailabilityService(IUnitOfWork unitOfWork, IBaseRepository<AvailabilitySlot> availabilitySlotRepository)
        {
            _unitOfWork = unitOfWork;
            _availabilitySlotRepository = availabilitySlotRepository;
        }

        public async Task<AvailabilitySlot> CreateAvailabilitySlot(AvailabilitySlot slot)
        {
            // Check for overlapping slots
            var overlappingSlots = await _availabilitySlotRepository.FindAsync(
                s => s.ProviderId == slot.ProviderId &&
                     s.StartTime < slot.EndTime &&
                     s.EndTime > slot.StartTime);

            if (overlappingSlots.Any())
            {
                throw new InvalidOperationException("The new availability slot overlaps with an existing one.");
            }

            await _availabilitySlotRepository.AddAsync(slot);
            await _unitOfWork.CompleteAsync();
            return slot;
        }

        public async Task DeleteAvailabilitySlot(int slotId)
        {
            var slot = await _availabilitySlotRepository.GetByIdAsync(slotId);
            if (slot == null)
            {
                throw new KeyNotFoundException($"Availability slot with ID {slotId} not found.");
            }

            _availabilitySlotRepository.Remove(slot);
            await _unitOfWork.CompleteAsync();
        }
    }
}
