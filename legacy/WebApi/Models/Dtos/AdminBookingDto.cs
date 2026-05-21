// WebApi/Models/Dtos/AdminBookingDto.cs
using System;
using WebApi.Models.Entities; // For BookingStatus

namespace WebApi.Models.Dtos
{
    public class AdminBookingDto
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
        public DateTime CreateTime { get; set; }
        public string Creator { get; set; }
        public DateTime UpdateTime { get; set; }
        public string Updater { get; set; }
    }
}
