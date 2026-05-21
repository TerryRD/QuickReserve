// WebApi/Models/Entities/Service.cs
using System;
using System.Collections.Generic;

namespace WebApi.Models.Entities
{
    public class Service : BaseEntity
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public int DurationInMinutes { get; set; }
        public decimal Price { get; set; }

        // Foreign Key
        public int ProviderId { get; set; }
        public virtual User Provider { get; set; } // Assuming User entity exists
    }
}
