// WebApi/Models/Entities/User.cs
using System;
using System.Collections.Generic;

namespace WebApi.Models.Entities
{
    public enum UserRole
    {
        Provider,
        Customer,
        Admin
    }

    public class User : BaseEntity
    {
        public string Name { get; set; }
        public string Email { get; set; }
        public string HashedPassword { get; set; }
        public UserRole Role { get; set; }

        // Navigation properties (dummy for now)
        public virtual ICollection<AvailabilitySlot> AvailabilitySlots { get; set; } = new List<AvailabilitySlot>();
        public virtual ICollection<Booking> CustomerBookings { get; set; } = new List<Booking>();
        public virtual ICollection<Booking> ProviderBookings { get; set; } = new List<Booking>();
    }
}
