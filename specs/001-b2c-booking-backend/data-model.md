# 數據模型: B2C 預約系統後端

此文件定義了 B2C 預約系統後端功能的核心數據實體。所有實體都繼承自 `BaseEntity`。

## 實體定義

### BaseEntity (基礎實體)

所有資料庫實體的基礎，提供標準的追蹤欄位。

```csharp
public abstract class BaseEntity
{
    public int Id { get; set; }
    public string Creator { get; set; }
    public DateTime CreateTime { get; set; }
    public string Updater { get; set; }
    public DateTime UpdateTime { get; set; }
}
```

### User (使用者)

系統中的使用者，可以是 Provider, Customer, 或 Admin。這裡使用單一 User 模型，透過角色來區分。

```csharp
public class User : BaseEntity
{
    public string Name { get; set; }
    public string Email { get; set; }
    public string HashedPassword { get; set; }
    public UserRole Role { get; set; } // Enum: Provider, Customer, Admin

    // Navigation properties
    public virtual ICollection<AvailabilitySlot> AvailabilitySlots { get; set; }
    public virtual ICollection<Booking> CustomerBookings { get; set; }
    public virtual ICollection<Booking> ProviderBookings { get; set; }
}

public enum UserRole
{
    Provider,
    Customer,
    Admin
}
```

### Service (服務)

Provider 提供的服務項目。

```csharp
public class Service : BaseEntity
{
    public string Name { get; set; }
    public string Description { get; set; }
    public int DurationInMinutes { get; set; }
    public decimal Price { get; set; }

    // Foreign Key
    public int ProviderId { get; set; }
    public virtual User Provider { get; set; }
}
```

### AvailabilitySlot (可用時段)

Provider 設定的可預約時間區塊。

```csharp
public class AvailabilitySlot : BaseEntity
{
    // Foreign Key
    public int ProviderId { get; set; }
    public virtual User Provider { get; set; }

    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public bool IsBooked { get; set; } // Denormalized flag for quick queries
    
    // Optional: Could hold a reference to the booking that filled this slot
    public int? BookingId { get; set; }
    public virtual Booking Booking { get; set; }
}
```

### Booking (預約紀錄)

Customer 發起的預約。

```csharp
public class Booking : BaseEntity
{
    // Foreign Keys
    public int CustomerId { get; set; }
    public virtual User Customer { get; set; }
    
    public int ProviderId { get; set; }
    public virtual User Provider { get; set; }

    public int ServiceId { get; set; }
    public virtual Service Service { get; set; }
    
    // The specific time slot this booking is for
    public int AvailabilitySlotId { get; set; }
    public virtual AvailabilitySlot AvailabilitySlot { get; set; }

    public BookingStatus Status { get; set; }
    
    // For future expansion (e.g., location, meeting link)
    public string ExtendedProperties { get; set; } // Stored as JSON string
}

public enum BookingStatus
{
    Pending,    // 待確認
    Confirmed,  // 已確認
    Completed,  // 已完成
    Cancelled   // 已取消
}
```

## 關聯

- `User` (Provider) to `Service`: 一對多
- `User` (Provider) to `AvailabilitySlot`: 一對多
- `User` (Customer) to `Booking`: 一對多
- `User` (Provider) to `Booking`: 一對多
- `Service` to `Booking`: 一對多
- `AvailabilitySlot` to `Booking`: 一對一
