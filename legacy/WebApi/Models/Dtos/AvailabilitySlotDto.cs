// WebApi/Models/Dtos/AvailabilitySlotDto.cs
using System;

namespace WebApi.Models.Dtos
{
    public class AvailabilitySlotDto
    {
        public int Id { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
    }
}
