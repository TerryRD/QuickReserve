// WebApi/Mappers/MappingProfile.cs
using AutoMapper;
using WebApi.Models.Dtos;
using WebApi.Models.Entities;

namespace WebApi.Mappers
{
    public class MappingProfile : Profile
    {
        public MappingProfile()
        {
            // AvailabilitySlot mapping
            CreateMap<AvailabilitySlotDto, AvailabilitySlot>();
            CreateMap<AvailabilitySlot, AvailabilitySlotDto>(); // Also add reverse mapping

            // Booking mapping
            CreateMap<Booking, BookingDetailsDto>()
                .ForMember(dest => dest.CustomerName, opt => opt.MapFrom(src => src.Customer.Name))
                .ForMember(dest => dest.ProviderName, opt => opt.MapFrom(src => src.Provider.Name))
                .ForMember(dest => dest.ServiceName, opt => opt.MapFrom(src => src.Service.Name))
                .ForMember(dest => dest.SlotStartTime, opt => opt.MapFrom(src => src.AvailabilitySlot.StartTime))
                .ForMember(dest => dest.SlotEndTime, opt => opt.MapFrom(src => src.AvailabilitySlot.EndTime));
            CreateMap<CreateBookingDto, Booking>(); // Not strictly needed as service creates the booking

            // User mapping
            CreateMap<User, UserDto>();

            // Admin Booking mapping
            CreateMap<Booking, AdminBookingDto>()
                .ForMember(dest => dest.CustomerName, opt => opt.MapFrom(src => src.Customer.Name))
                .ForMember(dest => dest.ProviderName, opt => opt.MapFrom(src => src.Provider.Name))
                .ForMember(dest => dest.ServiceName, opt => opt.MapFrom(src => src.Service.Name))
                .ForMember(dest => dest.SlotStartTime, opt => opt.MapFrom(src => src.AvailabilitySlot.StartTime))
                .ForMember(dest => dest.SlotEndTime, opt => opt.MapFrom(src => src.AvailabilitySlot.EndTime));
        }
    }
}
