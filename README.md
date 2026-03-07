# QuickReserve - B2C 預約系統 (全端)

## 專案概述

QuickReserve 是一個全端 B2C 預約系統，旨在讓服務供應商管理其可用時段和服務，並讓客戶預約這些服務。系統中也包含用於監控的管理員介面。

## 使用技術

### 後端
- **語言/版本**: C# (.NET 9.0)
- **框架**: ASP.NET Core Web API
- **ORM**: Entity Framework Core, Dapper
- **資料庫**: SQL Server
- **測試**: xUnit, Moq, Microsoft.AspNetCore.Mvc.Testing
- **日誌**: NLog
- **映射**: AutoMapper
- **身份驗證**: JWT Bearer

### 前端
- **語言/版本**: TypeScript
- **框架**: Vue 3 (Composition API, Vite)
- **UI 函式庫**: Naive UI
- **狀態管理**: Pinia
- **HTTP 用戶端**: Axios
- **測試**: Vitest, Vue Testing Library
- **日期工具**: date-fns

## 專案結構

```
/
├── WebApi/                # 後端 ASP.NET Core Web API 專案
├── WebApi.Test/           # 後端 xUnit 測試專案
├── WebApp/                # 前端 Vue 3 + TypeScript 專案
└── README.md              # 此檔案
```

## 設定與運行說明

### 先決條件
- .NET 9.0 SDK
- Node.js (LTS 版本)
- Docker Desktop (用於 SQL Server)
- Git 用戶端

### 1. 複製儲存庫
```bash
git clone <repository-url>
cd QuickReserve
```

### 2. 啟動資料庫 (透過 Docker 運行 SQL Server)
```bash
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=yourStrong(!)Password" \
   -p 1433:1433 --name sql1 -d mcr.microsoft.com/mssql/server:2022-latest
```
*請務必將 `yourStrong(!)Password` 替換為一個安全的密碼。*

### 3. 後端設定
1.  **進入 `WebApi` 目錄:*
    ```bash
    cd WebApi
    ```
2.  **更新資料庫遷移和綱要:*
    *(目前尚未新增任何遷移。此步驟將在建立遷移後應用。)*
    ```bash
    dotnet ef database update
    ```
3.  **運行後端應用程式:*
    ```bash
    dotnet run
    ```
    後端 API 通常可在 `https://localhost:7123` 存取，Swagger UI 則在 `https://localhost:7123/swagger`。

### 4. 前端設定
1.  **進入 `WebApp` 目錄:*
    ```bash
    cd WebApp
    ```
2.  **安裝依賴套件:*
    ```bash
    npm install
    ```
3.  **建立 `.env.local` 以設定 API 基本 URL:*
    在 `WebApp` 目錄中，建立一個 `.env.local` 檔案，內容如下：
    ```
VITE_API_BASE_URL=https://localhost:7123
```
4.  **運行前端開發伺服器:*
    ```bash
    npm run dev
    ```
    前端應用程式通常可在 `http://localhost:5173` 存取。

## 身份驗證與授權 (後端)
- 後端使用 JWT Bearer 身份驗證。
- 管理員端點 (`/api/admin/*`) 受基於角色的授權保護 (`[Authorize(Roles = "Admin")]`)。
- JWT 配置詳細資訊位於 `appsettings.json` 中。

## 測試
- **後端測試**: 位於 `WebApi.Test/`。運行命令為 `dotnet test`。
- **前端測試**: 位於 `WebApp/tests/unit/`。在 `WebApp` 目錄中運行命令為 `npm test`。

---
**注意**: 此 `README.md` 提供了一般指南。有關資料初始化、實際使用者角色以及更複雜的身份驗證流程的具體細節將作為進一步開發的一部分。