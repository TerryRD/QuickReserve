// WebApi/Models/Entities/Booking.cs
using System;
using System.Collections.Generic;

namespace WebApi.Models.Entities
{
    public enum BookingStatus
    {
        Pending,
        Confirmed,
        Completed,
        Cancelled
    }

    public class Booking : BaseEntity
    {
        public int CustomerId { get; set; }
        public virtual User Customer { get; set; }

        public int ProviderId { get; set; }
        public virtual User Provider { get; set; }

        public int ServiceId { get; set; }
        public virtual Service Service { get; set; }

        public int AvailabilitySlotId { get; set; }
        public virtual AvailabilitySlot AvailabilitySlot { get; set; }

        public BookingStatus Status { get; set; }

        public string ExtendedProperties { get; set; }
    }
}
