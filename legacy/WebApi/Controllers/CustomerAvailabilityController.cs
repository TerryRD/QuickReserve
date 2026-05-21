// WebApi/Controllers/CustomerAvailabilityController.cs
using Microsoft.AspNetCore.Mvc;
using WebApi.Models.Dtos;
using WebApi.Services;
using AutoMapper;
using System.Collections.Generic;
using System.Threading.Tasks;
using System;
using System.Linq; // For .Where() and .Select()
using WebApi.Repositories.Base;
using WebApi.Models.Entities;
using Microsoft.AspNetCore.Http; // For StatusCodes

namespace WebApi.Controllers
{
    [ApiController]
    [Route("api/customers/providers/{providerId}/availability")]
    public class CustomerAvailabilityController : ControllerBase
    {
        private readonly IAvailabilityService _availabilityService;
        private readonly IBaseRepository<AvailabilitySlot> _availabilitySlotRepository; // Direct access to repository for filtering
        private readonly IMapper _mapper;

        public CustomerAvailabilityController(IAvailabilityService availabilityService, IMapper mapper, IBaseRepository<AvailabilitySlot> availabilitySlotRepository)
        {
            _availabilityService = availabilityService; // For future complex logic
            _mapper = mapper;
            _availabilitySlotRepository = availabilitySlotRepository; // Used for fetching slots with filtering
        }

        /// <summary>
        /// (Customer) 查詢 Provider 在特定日期範圍內的可用時段
        /// </summary>
        /// <param name="providerId">Provider ID</param>
        /// <param name="startDate">開始日期 (YYYY-MM-DD)</param>
        /// <param name="endDate">結束日期 (YYYY-MM-DD)</param>
        /// <returns>可用時段列表</returns>
        [HttpGet]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<IEnumerable<AvailabilitySlotDto>>> GetProviderAvailability(
            int providerId,
            [FromQuery] DateTime startDate,
            [FromQuery] DateTime endDate)
        {
            if (startDate > endDate)
            {
                return BadRequest("Start date cannot be after end date.");
            }

            // Fetch available (not booked) slots for the given provider within the date range
            var slots = await _availabilitySlotRepository.FindAsync(s =>
                s.ProviderId == providerId &&
                !s.IsBooked && // Only show available slots
                s.StartTime >= startDate &&
                s.EndTime <= endDate.AddDays(1).AddTicks(-1)); // Include up to end of endDate

            var slotDtos = _mapper.Map<IEnumerable<AvailabilitySlotDto>>(slots);
            return Ok(slotDtos);
        }
    }
}
