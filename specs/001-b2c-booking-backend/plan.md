# 實作計畫: B2C 預約系統 (全端)

**分支**: `001-b2c-booking-backend` | **日期**: 2026-01-17 | **規格**: [spec.md](spec.md)
**輸入**: 功能規格來自 `specs/001-b2c-booking-backend/spec.md`

## 摘要

建立一個包含前端和後端的完整 B2C 預約系統。後端負責核心業務邏輯與資料庫互動，前端則為 Provider、Customer 和 Admin 提供互動式的使用者介面。

## 技術背景

### 後端

- **語言/版本**: C# (.NET 8)
- **主要依賴**: ASP.NET Core, Entity Framework Core, Dapper, AutoMapper, FluentValidation, NLog
- **儲存**: SQL Server
- **測試**: xUnit
- **目標平台**: Linux/Windows (Docker 容器)
- **專案類型**: Web API

### 前端

- **語言/版本**: TypeScript
- **框架**: Vue 3 (Composition API, 使用 Vite)
- **UI 函式庫**: Naive UI
- **狀態管理**: Pinia
- **資料請求**: Axios (或基於 `fetch` 的封裝)
- **測試**: Vitest, Vue Testing Library

## 專案章程檢查

*閘門：必須在階段 0 研究之前通過。在階段 1 設計後重新檢查。*

*   [x] **API 優先設計**: 功能將透過 OpenAPI 合約定義的 RESTful API 提供。
*   [x] **測試驅動開發**: 將為後端業務邏輯和前端組件建立測試。
*   [x] **乾淨架構**: 後端將遵循三層式架構，前端將採用功能驅動的模組化結構。
*   [ ] **CI/CD**: 需要設定包含前後端建置、測試和部署的整合管線。
*   [x] **可觀察性**: 後端將整合 NLog，前端將整合日誌服務。

## 專案結構

### 文件 (此功能)

```text
specs/001-b2c-booking-backend/
├── plan.md              # 此檔案
├── research.md          # 階段 0 產出
├── data-model.md        # 階段 1 產出 (後端)
├── quickstart.md        # 階段 1 產出
├── contracts/           # 階段 1 產出 (API)
└── tasks.md             # 階段 2 產出
```

### 原始碼 (儲存庫根目錄)
```text
/
├── WebApi/
│   ├── Controllers/
│   ├── Services/
│   │   └── Interfaces/
│   ├── Repositories/
│   │   └── ...
│   ├── Models/
│   │   ├── Entities/
│   │   └── Dtos/
│   └── ... (其他後端資料夾)
├── WebApi.Test/
│   └── ... (後端測試專案)
└── WebApp/
    ├── public/
    ├── src/
    │   ├── api/             # API 客戶端與類型
    │   ├── assets/          # 靜態資源
    │   ├── components/      # 可重用 UI 組件
    │   ├── router/          # 路由設定
    │   ├── stores/          # 狀態管理 (Pinia)
    │   ├── utils/           # 共用工具函式
    │   ├── views/           # 頁面級組件
    │   ├── App.vue
    │   └── main.ts
    ├── package.json
    └── tsconfig.json
```

**結構決策**: 專案採用類 Monorepo 結構，將 .NET 後端 (`WebApi`) 與 Vue 3 前端 (`WebApp`) 並列存放，以利於統一管理與部署。

## 複雜度追蹤

> **僅在違反專案章程且必須說明理由時填寫**

| 違反 | 為何需要 | 被拒絕的更簡單替代方案及其原因 |
|-----------|------------|-------------------------------------|
|           |            |                                     |