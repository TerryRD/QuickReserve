namespace WebApi.Models.Entities;

/// <summary>
/// 所有資料庫實體的基礎，提供標準的追蹤欄位。
/// </summary>
public abstract class BaseEntity
{
    public int Id { get; set; }
    public string Creator { get; set; } = string.Empty;
    public DateTime CreateTime { get; set; }
    public string Updater { get; set; } = string.Empty;
    public DateTime UpdateTime { get; set; }
}
