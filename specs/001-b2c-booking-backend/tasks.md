# 任務: B2C 預約系統 (全端)

**輸入**: 來自 `specs/001-b2c-booking-backend/` 的設計文件
**先決條件**: plan.md, spec.md, data-model.md, contracts/

---
## 階段 1: 專案初始化

**目的**: 建立前後端專案的基本結構和設定。

- [x] T001 [P] 使用 `dotnet new sln` 建立解決方案 `QuickReserve.sln`。
- [x] T002 [P] 在 `WebApi/` 中建立 ASP.NET Core Web API 專案，並將其加入解決方案。
- [x] T003 [P] 在 `WebApi.Test/` 中建立 xUnit 測試專案，並將其加入解決案。
- [x] T004 [P] 在 `WebApp/` 中使用 `npm create vite@latest` 初始化 Vue 3 + TypeScript 專案。
- [x] T005 [P] 在 `WebApp/` 中安裝核心依賴: `npm install vue-router pinia naive-ui axios`。
- [x] T006 [P] 在 `WebApp/` 中安裝開發依賴: `npm install -D @types/node @vue/test-utils vitest`。

---
## 階段 2: 基礎建設 (後端)

**目的**: 設定所有使用者故事都依賴的後端核心基礎設施。

- [x] T007 根據 `data-model.md` 在 `WebApi/Models/Entities/` 中定義 `BaseEntity.cs`。
- [x] T008 [P] 在 `WebApi/` 中設定 `DbContext`，並在 `appsettings.json` 中配置 SQL Server 連接字串。
- [x] T009 [P] 在 `WebApi/Repositories/Base/` 中建立泛型 `BaseRepository<T>`。
- [x] T010 [P] 在 `WebApi/Repositories/UnitOfWork/` 中定義 `IUnitOfWork.cs` 和 `UnitOfWork.cs`。
- [x] T011 [P] 在 `WebApi/Extensions/` 中建立 `IServiceCollection` 的擴充方法來註冊所有服務和倉儲。
- [x] T012 [P] 在 `WebApi/Filters/` 中建立全域 `ExceptionFilter.cs`。
- [x] T013 [P] 在 `WebApi/` 中設定 NLog。
- [x] T014 [P] 在 `WebApi/` 中設定 AutoMapper，建立基礎的 `MappingProfile.cs`。

---
## 階段 3: 基礎建設 (前端)

**目的**: 設定所有使用者故事都依賴的前端核心基礎設施。

- [x] T015 [P] 在 `WebApp/src/` 中建立 `api/` `components/` `router/` `stores/` `utils/` `views/` 資料夾結構。
- [x] T016 [P] 在 `WebApp/src/router/` 中設定 `index.ts`，配置基本路由。
- [x] T017 [P] 在 `WebApp/src/stores/` 中設定 Pinia 主 store。
- [x] T018 [P] 在 `WebApp/src/api/` 中建立一個 Axios 實例 (`apiClient.ts`)，配置 `VITE_API_BASE_URL`。
- [x] T019 [P] 在 `WebApp/src/main.ts` 中引入並設定 Naive UI 的 provider。
- [x] T020 [P] 建立一個主要的 `AppLayout.vue`，包含導航欄和頁面內容區域。

---
## 階段 4: 使用者故事 1 - Provider 管理可用時間 (P1) 🎯 MVP

**目標**: 允許 Provider 設定、查看和管理自己的可用時間。

### 後端測試 (US1)
- [x] T021 [US1] 為 `AvailabilityService` 撰寫單元測試，涵蓋建立、刪除和時間重疊檢查邏輯。
- [x] T022 [US1] 為 `/api/providers/availability` 端點撰寫整合測試。

### 後端實作 (US1)
- [x] T023 [P] [US1] 在 `WebApi/Models/Entities/` 中建立 `Service.cs` 和 `AvailabilitySlot.cs`。
- [x] T024 [P] [US1] 在 `WebApi/Models/Dtos/` 中建立 `AvailabilitySlotDto.cs`。
- [x] T025 [P] [US1] 為 `IAvailabilitySlotRepository` 和 `IServiceRepository` 建立介面和實作。
- [x] T026 [US1] 在 `WebApi/Services/` 中建立 `AvailabilityService`，實作建立和刪除可用時段的業務邏輯。
- [x] T027 [US1] 在 `WebApi/Controllers/` 中建立 `ProviderAvailabilityController.cs`，並實作 `POST` 和 `DELETE` 端點。
- [x] T028 [US1] 在 `MappingProfile.cs` 中新增 `AvailabilitySlot` 到 DTO 的對應。

### 前端測試 (US1)
- [x] T029 [P] [US1] 為 `ProviderScheduleCalendar.vue` 組件撰寫單元測試，驗證其能正確渲染事件。
- [x] T030 [P] [US1] 為 `AddAvailabilityModal.vue` 組件撰寫單元測試，驗證表單提交。

### 前端實作 (US1)
- [x] T031 [P] [US1] 在 `WebApp/src/views/` 中建立 `ProviderDashboard.vue` 頁面。
- [x] T032 [P] [US1] 在 `WebApp/src/components/` 中建立 `ProviderScheduleCalendar.vue` 組件，用於顯示可用和已預約時段。
- [x] T033 [P] [US1] 在 `WebApp/src/components/` 中建立 `AddAvailabilityModal.vue` 模態框組件，用於新增時段。
- [x] T034 [US1] 在 `WebApp/src/api/` 中新增 `availability.ts`，封裝與可用時段相關的 API 請求。
- [x] T035 [US1] 在 `WebApp/src/stores/` 中建立 `useAvailabilityStore.ts` (Pinia store)，管理時段數據。

---
## 階段 5: 使用者故事 2 - Customer 預約服務 (P1)

**目標**: 允許 Customer 查詢可用時段並成功建立預約。

### 後端測試 (US2)
- [x] T036 [US2] 為 `BookingService` 撰寫單元測試，特別是防止超額預約的原子性操作邏輯。
- [x] T037 [US2] 為 `POST /api/bookings` 端點撰寫整合測試，模擬並發請求。

### 後端實作 (US2)
- [x] T038 [P] [US2] 在 `WebApi/Models/Entities/` 中建立 `Booking.cs` 和相關 `enum`。
- [x] T039 [P] [US2] 在 `WebApi/Models/Dtos/` 中建立 `CreateBookingDto.cs` 和 `BookingDetailsDto.cs`。
- [x] T040 [P] [US2] 為 `IBookingRepository` 建立介面和實作。
- [x] T041 [US2] 在 `WebApi/Services/` 中建立 `BookingService.cs`，實作預約建立和查詢邏輯。
- [x] T042 [US2] 建立 `CustomerAvailabilityController.cs`，實作 `GET` 可用時段端點。
- [x] T043 [US2] 建立 `BookingsController.cs`，實作 `POST` 預約建立端點。

### 前端測試 (US2)
- [x] T044 [P] [US2] 為 `BookingForm.vue` 撰寫單- [x] T044 [P] [US2] 為 `BookingForm.vue` 撰寫單元測試，驗證使用者可以選擇時段並提交。

### 前端實作 (US2)
- [x] T045 [P] [US2] 在 `WebApp/src/views/` 中建立 `PublicProviderProfile.vue` 頁面，用於展示提供者的服務與可用時段。
- [x] T046 [P] [US2] 在 `WebApp/src/components/` 中建立 `BookingForm.vue`，讓使用者選擇服務和時段。
- [x] T047 [P] [US2] 在 `WebApp/src/views/` 中建立 `MyBookings.vue` 頁面，用於顯示個人預約紀錄。
- [x] T048 [US2] 在 `WebApp/src/api/` 中新增 `booking.ts`，封裝預約相關的 API 請求。
- [x] T049 [US2] 在 `WebApp/src/stores/` 中建立 `useBookingStore.ts` (Pinia store)，管理預約數據。

---
## 階段 6: 使用者故事 3 - Admin 監控系統 (P2)

**目標**: 允許 Admin 查看所有使用者和預約。

### 後端測試 (US3)
- [x] T050 [US3] 為 `AdminService` 和相關端點撰寫整合測試，確保只有 Admin 角色可以訪問。

### 後端實作 (US3)
- [x] T051 [P] [US3] 在 `WebApi/Models/Dtos/` 中建立 `UserDto.cs` 和 `AdminBookingDto.cs`。
- [x] T052 [US3] 在 `WebApi/Services/` 中建立 `AdminService`，實作查詢所有使用者和預約的邏輯。
- [x] T053 [US3] 建立 `AdminController.cs`，並實作 `GET /api/admin/users` 和 `GET /api/admin/bookings` 端點。
- [x] T054 [US3] 實作基於角色的授權策略，保護 Admin 端點。

### 前端實作 (US3)
- [x] T055 [P] [US3] 在 `WebApp/src/views/admin/` 中建立 `AdminDashboard.vue` 頁面。
- [x] T056 [P] [US3] 在 `WebApp/src/components/admin/` 中建立 `UsersTable.vue` 組件。
- [x] T057 [P] [US3] 在 `WebApp/src/components/admin/` 中建立 `BookingsTable.vue` 組件。
- [x] T058 [US3] 在 `WebApp/src/router/` 中新增 Admin 保護路由。

---
## 階段 N: 潤飾與跨領域關注點

- [x] T059 [P] 撰寫 `README.md`，更新專案說明和最終設定指南。
- [x] T060 [P] 補全所有公開 API 的 Swagger/OpenAPI 文件註解。
- [x] T061 審查和重構程式碼，確保一致性和可讀性。
- [x] T062 設定 CI/CD 管線，自動化前後端的測試和建置。
