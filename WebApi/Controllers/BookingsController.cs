// WebApi/Controllers/BookingsController.cs
using Microsoft.AspNetCore.Mvc;
using WebApi.Models.Dtos;
using WebApi.Models.Entities;
using WebApi.Services;
using AutoMapper;
using System.Threading.Tasks;
using System;
using System.Collections.Generic;
using Microsoft.AspNetCore.Http; // For StatusCodes

namespace WebApi.Controllers
{
    [ApiController]
    [Route("api/bookings")]
    public class BookingsController : ControllerBase
    {
        private readonly IBookingService _bookingService;
        private readonly IMapper _mapper;

        public BookingsController(IBookingService bookingService, IMapper mapper)
        {
            _bookingService = bookingService;
            _mapper = mapper;
        }

        /// <summary>
        /// (Customer) 建立一個新的預約
        /// </summary>
        /// <param name="createBookingDto">預約建立資料</param>
        /// <returns>建立成功的回應</returns>
        [HttpPost]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> CreateBooking([FromBody] CreateBookingDto createBookingDto)
        {
            // For now, assume customerId is 1 for testing purposes.
            // In a real application, this would come from the authenticated user context.
            int customerId = 1;

            try
            {
                var booking = await _bookingService.CreateBooking(
                    customerId,
                    createBookingDto.ServiceId,
                    createBookingDto.AvailabilitySlotId);

                var bookingDetailsDto = _mapper.Map<BookingDetailsDto>(booking); // Map to details DTO if needed
                return StatusCode(StatusCodes.Status201Created, bookingDetailsDto);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}
