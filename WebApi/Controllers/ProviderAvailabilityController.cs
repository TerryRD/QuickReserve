// WebApi/Controllers/ProviderAvailabilityController.cs
using Microsoft.AspNetCore.Mvc;
using WebApi.Models.Dtos;
using WebApi.Models.Entities;
using WebApi.Services;
using AutoMapper; // For mapping DTOs to entities
using System; // For InvalidOperationException, KeyNotFoundException
using System.Collections.Generic; // For IEnumerable
using Microsoft.AspNetCore.Http; // For StatusCodes

namespace WebApi.Controllers
{
    [ApiController]
    [Route("api/providers/availability")]
    public class ProviderAvailabilityController : ControllerBase
    {
        private readonly IAvailabilityService _availabilityService;
        private readonly IMapper _mapper; // For mapping DTOs

        public ProviderAvailabilityController(IAvailabilityService availabilityService, IMapper mapper)
        {
            _availabilityService = availabilityService;
            _mapper = mapper;
        }

        /// <summary>
        /// (Provider) 批次建立可用時段
        /// </summary>
        /// <param name="slots">可用時段列表</param>
        /// <returns>建立成功的回應</returns>
        [HttpPost]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> CreateAvailabilitySlots([FromBody] IEnumerable<AvailabilitySlotDto> slots)
        {
            // For now, let's assume ProviderId is 1 for testing purposes.
            // In a real application, this would come from the authenticated user context.
            int providerId = 1;

            var createdSlots = new List<AvailabilitySlot>();
            foreach (var slotDto in slots)
            {
                var slot = _mapper.Map<AvailabilitySlot>(slotDto);
                slot.ProviderId = providerId;
                slot.CreateTime = DateTime.UtcNow; // Set creation time
                slot.UpdateTime = DateTime.UtcNow; // Set update time
                slot.Creator = "System"; // Placeholder
                slot.Updater = "System"; // Placeholder

                try
                {
                    var createdSlot = await _availabilityService.CreateAvailabilitySlot(slot);
                    createdSlots.Add(createdSlot);
                }
                catch (InvalidOperationException ex)
                {
                    ModelState.AddModelError(string.Empty, ex.Message);
                    return BadRequest(ModelState);
                }
            }

            return StatusCode(StatusCodes.Status201Created, createdSlots);
        }

        /// <summary>
        /// (Provider) 刪除一個可用時段
        /// </summary>
        /// <param name="slotId">時段 ID</param>
        /// <returns>刪除成功的回應</returns>
        [HttpDelete("{slotId}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> DeleteAvailabilitySlot(int slotId)
        {
            try
            {
                await _availabilityService.DeleteAvailabilitySlot(slotId);
                return NoContent();
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
        }
    }
}
