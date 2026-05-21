// WebApi/Models/Dtos/CreateBookingDto.cs
namespace WebApi.Models.Dtos
{
    public class CreateBookingDto
    {
        public int ServiceId { get; set; }
        public int AvailabilitySlotId { get; set; }
        // CustomerId will likely come from authentication context
    }
}
