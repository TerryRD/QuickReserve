// WebApi/Models/Dtos/BookingDetailsDto.cs
using System;
using WebApi.Models.Entities; // For BookingStatus

namespace WebApi.Models.Dtos
{
    public class BookingDetailsDto
    {
        public int Id { get; set; }
        public int CustomerId { get; set; }
        public string CustomerName { get; set; }
        public int ProviderId { get; set; }
        public string ProviderName { get; set; }
        public int ServiceId { get; set; }
        public string ServiceName { get; set; }
        public DateTime SlotStartTime { get; set; }
        public DateTime SlotEndTime { get; set; }
        public BookingStatus Status { get; set; }
    }
}
