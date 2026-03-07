// WebApi/Models/Entities/AvailabilitySlot.cs
using System;
using System.Collections.Generic;

namespace WebApi.Models.Entities
{
    public class AvailabilitySlot : BaseEntity
    {
        // Foreign Key
        public int ProviderId { get; set; }
        public virtual User Provider { get; set; } // Assuming User entity exists

        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public bool IsBooked { get; set; } // Denormalized flag for quick queries
        
        // Optional: Could hold a reference to the booking that filled this slot
        public int? BookingId { get; set; }
        public virtual Booking Booking { get; set; } // Assuming Booking entity exists
    }
}
