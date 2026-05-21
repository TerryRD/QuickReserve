// WebApi/Models/Dtos/UserDto.cs
using WebApi.Models.Entities; // For UserRole

namespace WebApi.Models.Dtos
{
    public class UserDto
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
        public UserRole Role { get; set; }
    }
}
