# 研究報告: B2C 預約系統 (全端)

此文件記錄了為 B2C 預約系統選擇全端技術棧的決策過程。

## 後端決策總結

| 技術領域 | 選擇的技術 | 理由 | 考慮的替代方案 |
| --- | --- | --- | --- |
| 後端框架 | ASP.NET Core 8 | 遵循使用者指定的開發規範，提供高效能、跨平台和現代化的開發體驗。 | Node.js, Python (Django/FastAPI) |
| 語言 | C# 12 | .NET 生態系的原生語言，類型安全且功能強大。 | F# |
| 資料庫存取 (ORM) | Entity Framework Core | 遵循使用者指定的開發規範，與 .NET 深度整合，簡化開發。 | - |
| 資料庫存取 (高效能) | Dapper | 遵循使用者指定的開發規範，適用於複雜查詢和高效能場景。 | - |
| 資料庫 | SQL Server | 遵循使用者指定的資料庫選擇。 | PostgreSQL, MySQL |
| 測試框架 | xUnit | .NET 社群中流行且功能強大的測試框架，易於使用。 | NUnit, MSTest |
| API 規格 | OpenAPI (Swagger) | 業界標準，易於定義、協作和生成客戶端代碼。 | GraphQL |

*後端技術選擇均嚴格遵循使用者定義的開發規範。*

---

## 前端決策總結

| 技術領域 | 選擇的技術 | 理由 | 考慮的替代方案 |
| --- | --- | --- | --- |
| 前端框架 | Vue 3 (with Vite) | 遵循使用者指定的開發規範，以其漸進式、易於上手的特性和優異的性能而聞名。 | React, Angular |
| 語言 | TypeScript | 遵循使用者指定的開發規範，提供強大的類型系統。 | JavaScript |
| UI 函式庫 | Naive UI | 遵循使用者指定的開發規範，提供一整套豐富、美觀且效能優異的 Vue 3 組件。 | Element Plus, Ant Design Vue |
| 狀態管理 | Pinia | Vue 官方推薦的下一代狀態管理器，API 設計直觀且與 Vue DevTools 深度整合。 | Vuex |
| 測試 | Vitest & Vue Testing Library| Vitest 與 Vite 深度整合，提供極速的測試體驗。Vue Testing Library 鼓勵以使用者為中心的測試方法。 | Jest, Cypress |