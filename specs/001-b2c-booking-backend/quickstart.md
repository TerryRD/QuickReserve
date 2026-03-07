# 快速入門: B2C 預約系統 (全端)

本指南將引導您完成設定和執行 B2C 預約系統前後端專案的步驟。

## 先決條件

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js](https://nodejs.org/en) (LTS 版本)
- [Docker](https://www.docker.com/products/docker-desktop) (用於資料庫)
- 一個 Git 客戶端

---

## 後端設定與執行

1.  **複製儲存庫**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **啟動資料庫 (使用 Docker)**
    本專案推薦使用 Docker 來執行 SQL Server for Linux 的開發實例。
    ```bash
    docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=yourStrong(!)Password" \
       -p 1433:1433 --name sql1 -d mcr.microsoft.com/mssql/server:2022-latest
    ```
    *請務必將 `yourStrong(!)Password` 替換為一個安全的密碼。*

3.  **設定應用程式**
    在 `WebApi/` 目錄下的 `appsettings.Development.json` 中，確認資料庫連接字串是否正確。預設應如下：
    ```json
    {
      "ConnectionStrings": {
        "DefaultConnection": "Server=localhost,1433;Database=QuickReserveDB;User ID=sa;Password=yourStrong(!)Password;TrustServerCertificate=True"
      }
    }
    ```

4.  **執行後端應用程式**
    ```bash
    # 還原依賴項目
    dotnet restore

    # 套用資料庫遷移
    cd WebApi
    dotnet ef database update
    cd ..

    # 執行應用程式
    dotnet run --project ./WebApi/WebApi.csproj
    ```

5.  **訪問後端 API**
    應用程式啟動後，您可以在 `https://localhost:7123/swagger` (或類似的 URL) 找到 Swagger UI。

---

## 前端設定與執行

1.  **進入前端專案目錄**
    ```bash
    cd WebApp
    ```

2.  **安裝依賴項目**
    ```bash
    npm install
    ```

3.  **設定環境變數**
    在 `WebApp` 根目錄建立一個 `.env.local` 檔案，並設定後端 API 的 URL。
    ```
    VITE_API_BASE_URL=https://localhost:7123
    ```

4.  **執行前端開發伺服器**
    ```bash
    npm run dev
    ```

5.  **訪問前端應用**
    開發伺服器啟動後，您可以在瀏覽器中開啟 `http://localhost:5173` (或 Vite 顯示的其他 URL) 來查看前端頁面。