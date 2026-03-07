// WebApi/Controllers/AdminController.cs
using Microsoft.AspNetCore.Mvc;
using WebApi.Models.Dtos;
using WebApi.Services;
using AutoMapper;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization; // For authorization attributes
using WebApi.Models.Entities; // For UserRole
using Microsoft.AspNetCore.Http; // For StatusCodes

namespace WebApi.Controllers
{
    [ApiController]
    [Route("api/admin")]
    [Authorize(Roles = "Admin")] // Require Admin role for all actions in this controller
    public class AdminController : ControllerBase
    {
        private readonly IAdminService _adminService;
        private readonly IMapper _mapper;

        public AdminController(IAdminService adminService, IMapper mapper)
        {
            _adminService = adminService;
            _mapper = mapper;
        }

        /// <summary>
        /// (Admin) 取得所有使用者列表
        /// </summary>
        /// <returns>使用者列表</returns>
        [HttpGet("users")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)] // If not authenticated
        [ProducesResponseType(StatusCodes.Status403Forbidden)] // If not admin
        public async Task<ActionResult<IEnumerable<UserDto>>> GetAllUsers()
        {
            var users = await _adminService.GetAllUsers();
            var userDtos = _mapper.Map<IEnumerable<UserDto>>(users);
            return Ok(userDtos);
        }

        /// <summary>
        /// (Admin) 取得所有預約列表
        /// </summary>
        /// <returns>預約列表</returns>
        [HttpGet("bookings")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<ActionResult<IEnumerable<AdminBookingDto>>> GetAllBookings()
        {
            var bookings = await _adminService.GetAllBookings();
            var adminBookingDtos = _mapper.Map<IEnumerable<AdminBookingDto>>(bookings);
            return Ok(adminBookingDtos);
        }
    }
}
