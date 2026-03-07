# QuickReserve 系統使用者手冊

歡迎使用 QuickReserve！本手冊旨在引導新使用者快速設定、運行並了解本系統。

## 1. 系統簡介

QuickReserve 是一個全端 B2C 預約系統。它允許：
*   **服務供應商 (Provider)**：管理他們的服務項目和可預約時間。
*   **客戶 (Customer)**：瀏覽供應商服務並預約可用的時段。
*   **管理員 (Admin)**：監控系統中的所有使用者和預約紀錄。

## 2. 先決條件

在開始設定系統之前，請確保您的開發環境中已安裝以下軟體：

*   **[.NET 9.0 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)**：用於運行後端服務。
*   **[Node.js](https://nodejs.org/en)** (LTS 版本)：用於運行前端應用程式。
*   **[Docker Desktop](https://www.docker.com/products/docker-desktop)**：用於運行 SQL Server 資料庫。
*   **Git 客戶端**：用於克隆專案儲存庫。

## 3. 環境設定

請依照以下步驟設定並運行 QuickReserve 系統的後端和前端。

### 3.1. 克隆專案儲存庫

開啟您的終端機 (例如：PowerShell、Git Bash 或 CMD)，並執行以下命令來克隆專案：

```bash
git clone <您的專案儲存庫網址>
cd QuickReserve
```

### 3.2. 啟動資料庫 (SQL Server via Docker)

QuickReserve 的後端需要一個 SQL Server 資料庫。我們建議使用 Docker 來快速啟動一個開發用的 SQL Server 實例：

```bash
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=yourStrong(!)Password" \
   -p 1433:1433 --name sql1 -d mcr.microsoft.com/mssql/server:2022-latest
```
**重要提示**：請將 `yourStrong(!)Password` 替換為一個安全且複雜的密碼。請務必記住這個密碼，因為後端設定需要它。

### 3.3. 後端設定與運行

後端是一個 ASP.NET Core Web API 專案。

1.  **進入後端專案目錄**：
    ```bash
    cd WebApi
    ```

2.  **更新資料庫遷移和綱要**：
    *   如果專案有新的資料庫遷移 (Migrations)，此步驟將會應用這些變更，建立或更新資料庫結構。
    *   目前專案尚未包含任何遷移檔案。在首次運行時，EF Core 將會根據程式碼中的實體自動建立資料庫。
    ```bash
dotnet ef database update
```

3.  **運行後端應用程式**：
    ```bash
dotnet run
```
    應用程式啟動後，您應該會看到類似於 `info: Microsoft.Hosting.Lifetime[14]: Now listening on: https://localhost:7123` 的訊息。
    *   後端 API 的基礎網址通常是 `https://localhost:7123`。
    *   您可以透過瀏覽器訪問 **Swagger UI** (`https://localhost:7123/swagger`) 來查看所有可用的 API 端點並進行測試。

### 3.4. 前端設定與運行

前端是一個基於 Vue 3 和 TypeScript 的應用程式。

1.  **進入前端專案目錄**：
    ```bash
    cd WebApp
    ```

2.  **安裝依賴套件**：
    ```bash
npm install
```

3.  **建立 `.env.local` 檔案**：
    前端需要知道後端 API 的位置。在 `WebApp` 目錄下建立一個名為 `.env.local` 的檔案，並加入以下內容：
    ```
VITE_API_BASE_URL=https://localhost:7123
```
    **注意**：請確保 `VITE_API_BASE_URL` 的值與您後端 API 實際運行的網址相符。

4.  **運行前端開發伺服器**：
    ```bash
npm run dev
```
    應用程式啟動後，您應該會看到類似於 `VITE v5.1.0 ready in 329 ms` 和 `➜ Local: http://localhost:5173/` 的訊息。
    *   在您的瀏覽器中打開 `http://localhost:5173` (或終端機中顯示的其他網址) 即可訪問前端應用程式。

## 4. 系統功能概覽

成功運行系統後，您可以體驗以下主要功能：

### 4.1. 供應商儀表板 (Provider Dashboard)
*   **訪問**：`http://localhost:5173/provider/dashboard`
*   **功能**：供應商可以在此處管理自己的服務和可用時間。您可以新增、編輯或刪除可預約的時段。

### 4.2. 客戶預約 (Customer Booking)
*   **訪問**：`http://localhost:5173/provider/<providerId>` (請替換 `<providerId>` 為實際供應商 ID，例如 `http://localhost:5173/provider/1`)
*   **功能**：客戶可以瀏覽特定供應商的服務和可用時段，並進行預約。
*   **我的預約**：`http://localhost:5173/my-bookings`，客戶可以在此查看自己的預約紀錄。

### 4.3. 管理員儀表板 (Admin Dashboard)
*   **訪問**：`http://localhost:5173/admin/dashboard`
*   **功能**：管理員可以在此處監控系統中的所有使用者和預約紀錄。此功能需要管理員權限才能訪問。

## 5. 測試

### 5.1. 運行後端測試
1.  進入後端測試專案目錄：
    ```bash
    cd WebApi.Test
    ```
2.  運行測試：
    ```bash
dotnet test
```

### 5.2. 運行前端測試
1.  進入前端專案目錄：
    ```bash
    cd WebApp
    ```
2.  運行測試：
    ```bash
npm test
```

## 6. 常見問題與疑難排解

*   **PowerShell 腳本執行錯誤 (UnauthorizedAccess)**：如果在運行 `check-prerequisites.ps1` 時遇到此錯誤，表示您的 PowerShell 執行策略限制了腳本的運行。您可以暫時繞過此策略：
    ```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "<腳本路徑>"
```
*   **NuGet 套件安裝失敗 (Invalid Package Source)**：如果 `dotnet add package` 失敗，可能是因為存在無效的 NuGet 套件來源。您可以檢查並移除它們：
    ```bash
dotnet nuget list source
dotnet nuget remove source "無效的來源名稱"
```
*   **後端 API 無法啟動或前端無法連接後端**：
    *   確保 Docker 中的 SQL Server 容器已成功運行，並且 `appsettings.json` 中的資料庫連接字串正確。
    *   檢查 `WebApp/.env.local` 中的 `VITE_API_BASE_URL` 是否與後端 API 的實際網址相符。
    *   檢查後端終端機輸出是否有任何錯誤訊息。

---

祝您使用 QuickReserve 愉快！如果您有任何問題，請查閱專案文件或聯繫開發團隊。
