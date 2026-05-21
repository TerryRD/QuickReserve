# QuickReserve 重新架構設計文件

**建立日期**: 2026-05-21
**狀態**: 待審閱
**作者**: terry@webplus.com.tw（透過 brainstorming skill 共同產出）

---

## 1. 背景與目標

### 1.1 現況
專案 `QuickReserve` 原為 B2C 預約系統，技術堆疊：
- 後端：ASP.NET Core 9 + Entity Framework Core
- 前端：Vue 3 + Vite
- 資料庫：SQL Server
- 認證：JWT
- 部署：尚未實際部署

原規格定義於 `specs/001-b2c-booking-backend/`，含 Provider / Customer / Admin 三種角色。

### 1.2 重新架構動機
1. 改採 **Vercel + Supabase** 部署，需更換技術堆疊
2. 業務模式從「單純 B2C」演進為「**B2B2C SaaS 多租戶平台**」
3. 增加完整的行事曆管理功能（批量、重複、衝突偵測）
4. 增加通知系統（Web Push）
5. 對效能與資料隔離安全有嚴格要求

### 1.3 目標
建立一個服務「服務提供者（如桌球教練）」的多租戶 SaaS 平台，讓教練能：
- 管理自己的可預約時段
- 開放給自己的客戶（學員）預約
- 管理旗下助教
- 收發各種通知

同時讓平台管理員（本專案擁有者）能管理所有租戶。

---

## 2. MVP 範圍

### 2.1 包含
- 多租戶架構（Supabase Auth + Row Level Security）
- 三層使用者：平台管理員、教練（Owner + Staff 一層助教）、學員
- 路徑式公開連結（`/wang-coach`）
- 服務（Service）定義與管理
- 可用時段（AvailabilitySlot）管理
- **批量建立時段（系統內 UI，無檔案匯入）**
- **重複規則**：每天 / 每週 X / 每月 N 號 / 每 N 天，含結束條件（N 次 / 截止日 / 無限）
- **衝突偵測 + 跳轉到衝突項目**
- 學員預約流程（必須註冊登入）
- 教練手動確認流程（Pending 立即鎖定時段）
- **通知系統**：
  - 每週日 20:00 寄下週預覽
  - 每日 07:00 提醒當日行程
  - 預約前 N 分鐘提醒（使用者可自訂）
  - 即時事件通知（新預約 / 確認 / 取消 / 改時間）
  - 管道：Web Push（含 Service Worker）
  - 使用者偏好設定 UI
- 平台管理員後台（B2 級：可暫停租戶、邀請教練、查看任何資料）
- 單一時區（`Asia/Taipei`）

### 2.2 不在 MVP 範圍
- 金流（線上付款、訂金、月結匯款）
- 多層階層助教（資料模型預留 `parent_member_id`，但 MVP 只實作一層）
- CSV / Excel 檔案匯入
- Google Calendar / iCal 雙向同步
- LINE 通知（資料模型預留 user 通道偏好欄位）
- Email 通知（僅用於 Supabase Auth 的註冊驗證與密碼重設）
- SMS 通知
- 多時區
- 自訂網域（教練自己的 domain CNAME）
- 行動 App（PWA 可視為非目標）
- 複雜重複規則（RRULE 完整規格、例外日期、不規則模式）

### 2.3 預估時程
8-14 週實作完成 MVP（依工程師人力而定）。

---

## 3. 使用者與角色

| 角色 | 來源 | 權限範圍 |
|------|------|---------|
| 平台管理員（Platform Admin） | 透過 `platform_admins` 表手動加入 | 全平台，可暫停/啟用租戶、邀請教練、查所有資料 |
| 教練 Owner | 平台管理員邀請 | 自己租戶內全部資料 + 邀請 / 管理助教 |
| 教練 Staff（助教） | Owner 邀請 | 自己的行事曆與預約；**看不到 Owner 或其他 Staff 資料** |
| 學員（Customer） | 自行註冊（透過教練連結） | 自己的預約紀錄；可在多個租戶下各自有獨立紀錄 |

### 3.1 跨層級限制
- 平台管理員「**讀**」任何資料 OK，「**寫**」需經過業務流程（例如不能直接代教練建立預約）
- Owner 可看 Staff 行事曆 + 預約紀錄；Staff 看不到 Owner
- 學員只能看自己的預約，不能看其他學員、不能看教練內部資料

---

## 4. 功能需求 (Functional Requirements)

### 4.1 帳號與多租戶
- **FR-001**: 系統需支援平台管理員 / 教練 / 學員三種角色，由 Supabase Auth 統一管理
- **FR-002**: 每位教練擁有獨立租戶（Tenant）；同帳號不可跨租戶（一位教練只能屬於一個租戶）
- **FR-003**: 每個租戶有唯一 slug（用於公開連結 `/wang-coach`），slug 全平台唯一
- **FR-004**: 教練 Owner 可邀請助教加入自己的租戶
- **FR-005**: 學員可在多個租戶下預約，但每個租戶看到的是「該租戶的學員紀錄」，跨租戶資料不共享

### 4.2 服務管理
- **FR-010**: 教練 Owner 可建立 / 編輯 / 停用「服務項目」（Service），含名稱、描述、時長、價格
- **FR-011**: Service 有 `extended_properties` (jsonb) 預留欄位，供未來新增屬性（如線上會議連結、地點）
- **FR-012**: Staff 可看到所屬租戶的所有 Service，但不可建立 / 編輯

### 4.3 可用時段管理
- **FR-020**: 教練可單筆建立可用時段（指定 service、日期、起迄時間）
- **FR-021**: 教練可**批量建立**時段：透過 UI 一次建立多筆（含重複規則）
- **FR-022**: 重複規則支援：
  - **每天**：interval = N
  - **每週**：選定週幾（可複選）
  - **每月**：每月第 N 號
  - **每 N 天**：interval = N
- **FR-023**: 重複規則需指定結束條件：
  - 連續 N 次（例：12 週）
  - 截止日期前
  - 無限（持續滑動視窗 90 天）
- **FR-024**: 重複規則建立後立即物化（materialize）為實體 `availability_slots`（往後 90 天視窗內）
- **FR-025**: 每日 00:30 由 pg_cron / Vercel Cron 推進「滑動視窗」，新增 90 天視窗尾端的時段
- **FR-026**: 教練可刪除單一時段（例如「下週二我請假」）
- **FR-027**: 同一個 member 的時段**不可重疊**，由資料庫 EXCLUDE 約束強制執行
- **FR-028**: 新增時段若與既有時段重疊：
  - 系統需回傳「結構化的衝突資訊」（含每筆衝突 slot 的 id、時間、服務、是否已被預約）
  - UI 需顯示衝突列表，並提供「跳轉去調整」按鈕，導向 `/calendar/slot/[id]?fromConflict=1`
  - 批量建立時，提供「略過衝突日，建立其他」選項

### 4.4 預約流程
- **FR-030**: 學員必須註冊登入才能預約
- **FR-031**: 學員可瀏覽教練的公開頁（`/[tenantSlug]`）查看服務與可用時段
- **FR-032**: 學員預約時系統建立 `bookings` 紀錄（status = `pending`），同時將對應 slot status 設為 `pending`（鎖定）
- **FR-033**: 教練可看到 `pending` 預約，並執行「確認」或「拒絕」
  - 確認：booking status → `confirmed`、slot status → `booked`
  - 拒絕：booking status → `cancelled`、slot status → `available`
- **FR-034**: 預約建立時需用 `SELECT ... FOR UPDATE` 行鎖 + EXCLUDE 約束雙重保險，防止 race condition
- **FR-035**: 學員可取消自己的預約（在預約開始時間之前皆可取消，含已被教練確認的預約）
- **FR-036**: 教練可取消任一狀態的預約（`pending` 或 `confirmed`），無時限
- **FR-037**: 預約取消時的狀態機：
  - `booking.status` → `cancelled`、`cancelled_at` / `cancelled_by` 填寫
  - 對應 `slot.status`：若為 `pending` 或 `booked` → 回到 `available`（時段釋出供他人預約）
  - 推送通知給對方

### 4.5 助教管理
- **FR-040**: 教練 Owner 可邀請助教（Staff）加入租戶
- **FR-041**: 邀請流程：Owner 輸入 email → 系統寄出邀請連結 → 被邀請者開連結並註冊 / 登入後加入租戶
- **FR-042**: Owner 可查看 Staff 的行事曆與預約清單（與自己等同視之）
- **FR-043**: Staff 只能看自己的行事曆，看不到 Owner 或其他 Staff
- **FR-044**: 資料表 `tenant_members.parent_member_id` 欄位預留多層階層擴充用（MVP 不啟用）

### 4.6 平台管理員後台
- **FR-050**: 平台管理員可看到所有租戶列表，含建立日期、狀態（active/suspended）、教練人數、預約總數
- **FR-051**: 平台管理員可暫停 / 啟用任意租戶。暫停效果：
  - 該租戶的公開頁 `/[tenantSlug]` 顯示「服務暫停中」
  - Owner / Staff 仍可登入但所有後台頁顯示「您的租戶已被暫停，請聯絡平台管理員」
  - 既有預約不會被取消，但無法建立新預約
  - 排程通知對該租戶相關預約跳過發送
- **FR-052**: 平台管理員可邀請新教練（建立新租戶 + 寄出 Owner 邀請）
- **FR-053**: 平台管理員可進入任何租戶查看資料（唯讀，含預約、學員、服務、時段）
- **FR-054**: 平台管理員無金流 / 訂閱管理功能（MVP 不含）

### 4.7 通知系統
- **FR-060**: 使用者首次登入後系統提示啟用 Web Push 通知；同意後將 `PushSubscription` 存入 `push_subscriptions`
- **FR-061**: 同一位使用者可在多裝置訂閱（手機 + 桌機 + 平板）
- **FR-062**: 使用者可在「設定 → 通知」開關以下項目：
  - 每週日預覽（可關）
  - 每日早晨提醒（可關，可調整時間 06:00-12:00）
  - 預約前提醒（可多選：5 / 10 / 15 / 30 / 60 / 1 天前）
  - 即時事件通知（可關）
- **FR-063**: 每週日 20:00（UTC+8）對所有啟用者寄出「下週預覽」通知
- **FR-064**: 每小時（06:00-12:00 UTC+8 之間）觸發排程，篩選「`daily_reminder_hour` 等於當前小時 + 今天有預約 + 已啟用」的使用者寄送「今日提醒」通知（預設 07:00）
- **FR-065**: 每分鐘掃描即將開始的預約，依使用者偏好寄出「N 分鐘前提醒」通知
- **FR-066**: 即時事件（新預約申請、確認、取消、改時間）發生時立即推送給相關方
- **FR-067**: 所有通知寫入 `notification_log` 紀錄，含唯一鍵防止重複觸發
- **FR-068**: 訂閱失效（web-push 回 `410 Gone`）自動從 `push_subscriptions` 刪除

---

## 5. 非功能需求 (Non-Functional Requirements)

### 5.1 效能（NFR-P）
- **NFR-P1**: 公開預約頁（`/[tenantSlug]`）的 LCP ≤ **500ms** (P75)
- **NFR-P2**: 登入 / 註冊頁 LCP ≤ 300ms
- **NFR-P3**: 學員「我的預約」頁 LCP ≤ 800ms
- **NFR-P4**: 教練後台行事曆頁 LCP ≤ 1000ms
- **NFR-P5**: 平台管理員後台 LCP ≤ 2000ms
- **NFR-P6**: 公開頁首頁 JS bundle ≤ 80KB (gzip)
- **NFR-P7**: 預約建立 API 在 P95 應 ≤ 500ms

### 5.2 安全（NFR-S）
- **NFR-S1**: 業務邏輯不可洩漏到前端（透過 RSC + Server Action 達成）
- **NFR-S2**: 多租戶資料隔離由 **PostgreSQL Row Level Security** 強制，應用程式層失誤不影響資料隔離
- **NFR-S3**: 所有 Server Action 用 Zod 驗證輸入
- **NFR-S4**: 敏感端點（login / signup / booking creation / password reset）加上 Rate Limit
- **NFR-S5**: Cron 端點需檢查 `Authorization: Bearer $CRON_SECRET`
- **NFR-S6**: 密碼由 Supabase Auth 處理（不自行儲存）
- **NFR-S7**: 所有寫入操作需通過 L3 業務規則檢查 + L4 RLS 雙重防線

### 5.3 可用性（NFR-A）
- **NFR-A1**: 系統可用性目標 99.5%（Vercel + Supabase 自身的 SLA 已超過此值）
- **NFR-A2**: 排程任務失敗需 log 與告警（Sentry）
- **NFR-A3**: 預約衝突偵測為原子操作，併發下絕不超賣

### 5.4 維護性
- **NFR-M1**: 端到端 TypeScript 型別共享
- **NFR-M2**: 結構化 log（pino）+ Sentry error tracking
- **NFR-M3**: CI 跑 Lighthouse 預算測試，LCP regression 自動警告

---

## 6. 系統架構

### 6.1 部署架構
```
                   ┌─────────────────────┐
                   │   使用者瀏覽器        │
                   │   (Chrome/Safari)    │
                   └──────────┬───────────┘
                              │ HTTPS
              ┌───────────────▼────────────────┐
              │      ▲ Vercel                  │
              │  ┌──────────┐  ┌────────────┐ │
              │  │ Next.js  │  │  Cron      │ │
              │  │ App      │  │  Tasks     │ │
              │  └────┬─────┘  └─────┬──────┘ │
              │       │              │         │
              │       └──────┬───────┘         │
              │              │                 │
              └──────────────┼─────────────────┘
                             │ Postgres protocol
                  ┌──────────▼──────────────┐
                  │   ⚡ Supabase           │
                  │  ┌─────────┐ ┌────────┐ │
                  │  │Postgres │ │  Auth  │ │
                  │  │+ RLS    │ │        │ │
                  │  │+ pg_cron│ │        │ │
                  │  └─────────┘ └────────┘ │
                  └─────────────────────────┘
```

### 6.2 技術選擇
| 層 | 技術 | 理由 |
|----|------|------|
| 框架 | Next.js 15 App Router | RSC + Server Action 滿足效能與安全要求 |
| 語言 | TypeScript (strict) | 端到端型別安全 |
| UI | Tailwind CSS + shadcn/ui | utility-first，最小 bundle，元件可客製 |
| 行事曆視覺化 | FullCalendar 或 react-day-picker | 視場景挑選 |
| 表單 | React Hook Form + Zod | 客戶端驗證 + 共享 schema |
| Server Action 包裝 | next-safe-action | 統一錯誤處理 + Zod 驗證 |
| 資料庫 | Supabase PostgreSQL | RLS、EXCLUDE、jsonb、pg_cron 都好用 |
| 認證 | Supabase Auth | Email / OAuth (Google)，JWT 自動帶 user metadata |
| 通知 | web-push 套件 + Service Worker | Web Push 標準實作 |
| 排程 | Vercel Cron + pg_cron | 跨服務任務由 Vercel、純 DB 任務由 pg_cron |
| Rate Limit | @upstash/ratelimit + Vercel KV | 免費額度足夠 MVP |
| 監控 | Sentry + Vercel Speed Insights | 錯誤追蹤 + 真實使用者效能 |
| Log | pino | 結構化 log，Vercel 自動收集 |

### 6.3 路由結構
```
app/
├── (auth)/
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   └── reset-password/page.tsx
│
├── (platform)/                  # 平台管理員後台
│   ├── platform/tenants/
│   ├── platform/analytics/
│   └── platform/admins/
│
├── (tenant)/                    # 教練後台（Owner/Staff）
│   ├── dashboard/
│   ├── calendar/                # 行事曆主視圖
│   ├── calendar/slot/[id]/      # 單一 slot 編輯（衝突跳轉目的地）
│   ├── bookings/                # 預約管理
│   ├── services/                # 服務項目管理
│   ├── staff/                   # 助教管理（僅 Owner 可見）
│   ├── customers/               # 學員清單
│   └── settings/notifications/
│
├── [tenantSlug]/                # 公開預約頁
│   ├── page.tsx                 # 教練介紹 + 服務列表
│   └── book/[serviceId]/        # 選時段 + 預約
│
├── (customer)/                  # 學員後台
│   ├── my-bookings/
│   └── settings/notifications/
│
├── api/
│   ├── cron/
│   │   ├── weekly-summary/route.ts
│   │   ├── daily-reminder/route.ts
│   │   ├── pre-event-reminder/route.ts
│   │   └── materialize-recurring/route.ts
│   └── push/
│       └── subscribe/route.ts   # 註冊 Push Subscription
│
└── (root)/
    └── page.tsx                 # 首頁 / 落地頁
```

### 6.4 Middleware
位於 `middleware.ts`，攔截所有請求，按路由分區檢查：
- `(platform)/*` — 需平台管理員身分
- `(tenant)/*` — 需 active 租戶成員身分
- `(customer)/*` — 需登入
- `[tenantSlug]/*` — 公開（但 booking 動作需登入）

無權限 → redirect 至 `/login`。

---

## 7. 資料模型

### 7.1 ER 概覽
9 張表，分四群：身分 / 服務 / 行事曆 / 通知。

```
身分群：
  tenants ─────┬── tenant_members
               └── tenant_customers ─── customers (auth.users 衍生)

服務群：
  services (tenant_id)

行事曆群：
  recurring_rules (tenant_id, member_id, service_id)
       │
       ▼ 物化
  availability_slots (tenant_id, member_id, service_id, recurring_rule_id?)
                            │
                            ▼ 被預約
  bookings (tenant_id, slot_id, customer_id, service_id)

通知群：
  push_subscriptions (user_id)
  notification_preferences (user_id)
  notification_log (user_id, type, related_id)
```

### 7.2 表結構（核心）

```sql
-- tenants
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active'  -- active | suspended
    CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tenants_slug ON tenants(slug);

-- tenant_members (Owner / Staff)
CREATE TABLE tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'staff')),
  parent_member_id UUID REFERENCES tenant_members(id),  -- 預留多層
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited', 'removed')),
  invited_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);
CREATE INDEX idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX idx_tenant_members_tenant ON tenant_members(tenant_id);

-- platform_admins
CREATE TABLE platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- customers (學員 profile，auth.users 1:1)
CREATE TABLE customers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- tenant_customers (跨租戶隔離的橋接)
CREATE TABLE tenant_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tenant_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, customer_id)
);

-- services
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
  price NUMERIC(10, 2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  extended_properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_services_tenant ON services(tenant_id, is_active);

-- recurring_rules
CREATE TABLE recurring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES tenant_members(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id),
  freq TEXT NOT NULL CHECK (freq IN ('daily', 'weekly', 'monthly', 'every_n_days')),
  interval_n INT NOT NULL DEFAULT 1 CHECK (interval_n >= 1),
  by_weekday INT[],  -- weekly only, [1,3,5] = 一三五 (ISO 8601, 1=Mon)
  by_month_day INT CHECK (by_month_day BETWEEN 1 AND 31),  -- monthly only
  start_time TIME NOT NULL,
  end_time TIME NOT NULL CHECK (end_time > start_time),
  start_date DATE NOT NULL,
  end_condition TEXT NOT NULL CHECK (end_condition IN ('count', 'until', 'none')),
  end_count INT,
  end_until DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recurring_rules_active ON recurring_rules(is_active, tenant_id);

-- availability_slots（核心，含 EXCLUDE 約束）
CREATE TABLE availability_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES tenant_members(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id),
  recurring_rule_id UUID REFERENCES recurring_rules(id) ON DELETE SET NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'pending', 'booked', 'cancelled')),
  extended_properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (start_at < end_at)
);

-- 關鍵：防重疊（GIST EXCLUDE）
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE availability_slots
  ADD CONSTRAINT availability_slots_no_overlap
  EXCLUDE USING gist (
    member_id WITH =,
    tstzrange(start_at, end_at) WITH &&
  ) WHERE (status <> 'cancelled');

CREATE INDEX idx_slots_tenant_member_start ON availability_slots(tenant_id, member_id, start_at);
CREATE INDEX idx_slots_start_status ON availability_slots(start_at, status);

-- bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES availability_slots(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  service_id UUID NOT NULL REFERENCES services(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  customer_notes TEXT,
  tenant_notes TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID,  -- 哪個 user 取消的
  extended_properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bookings_tenant_status ON bookings(tenant_id, status);
CREATE INDEX idx_bookings_customer ON bookings(customer_id, status);
CREATE INDEX idx_bookings_slot ON bookings(slot_id);

-- push_subscriptions
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_subs_user ON push_subscriptions(user_id);

-- notification_preferences
CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  weekly_summary_enabled BOOLEAN NOT NULL DEFAULT true,
  daily_reminder_enabled BOOLEAN NOT NULL DEFAULT true,
  daily_reminder_hour INT NOT NULL DEFAULT 7 CHECK (daily_reminder_hour BETWEEN 0 AND 23),
  pre_event_minutes INT[] NOT NULL DEFAULT '{30}',
  pre_event_enabled BOOLEAN NOT NULL DEFAULT true,
  booking_status_changes_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- notification_log
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL,  -- weekly_summary | daily_reminder | pre_event | booking_status
  related_id UUID,
  scheduled_for TIMESTAMPTZ,  -- 對 pre_event 提醒用
  channel TEXT NOT NULL DEFAULT 'web_push',
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, type, related_id, scheduled_for)
);
```

### 7.3 RLS Policies（範例）

每張業務表都啟用 RLS：

```sql
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- 教練只能看自己租戶的預約
CREATE POLICY bookings_tenant_members ON bookings FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM tenant_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- 學員只能看自己的預約
CREATE POLICY bookings_own_customer ON bookings FOR SELECT
USING (customer_id = auth.uid());

-- 平台管理員可看所有
CREATE POLICY bookings_platform_admin ON bookings FOR SELECT
USING (EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid()));
```

寫入操作的 RLS 類似，僅放行對應角色。

---

## 8. 安全策略（四層縱深）

| 層 | 機制 | 阻擋什麼 |
|----|------|---------|
| **L1 入口層** | Vercel 邊緣 + Rate Limit（`@upstash/ratelimit` + Vercel KV） | DDoS、暴力破解 login / signup / booking / password reset |
| **L2 Middleware** | Next.js Middleware 攔截，按路由區檢查角色 | 未登入或角色不符的 navigation |
| **L3 Server Action** | `next-safe-action` 包裝：Zod 驗證 + Auth 檢查 + 業務規則 | 不合法輸入、權限不足、狀態機違反 |
| **L4 PostgreSQL** | RLS 政策 + EXCLUDE 約束 + 外鍵約束 | 應用層失誤、SQL Injection、租戶資料洩漏 |

### 8.1 業務邏輯不外洩
- 所有業務邏輯寫在 Server Action / RSC 中（標記 `'use server'`）
- Next.js 編譯時自動把 server-only 程式碼從 client bundle 移除
- 瀏覽器只看到 form submit → opaque payload（無法解碼出函式內容）
- 開啟 DevTools Network 看不到 SQL、看不到 schema、看不到驗證規則

### 8.2 Server Action 標準骨架
```ts
'use server'

const Schema = z.object({...})

export const action = createSafeAction(Schema, async (input, ctx) => {
  // ctx 含 user, tenant, role（已通過 auth check）
  // 業務規則檢查...
  // DB 操作（受 RLS 保護）...
  return result
})
```

### 8.3 敏感資訊管理
- 所有密鑰存於 Vercel 環境變數（Production / Preview / Development 分開）
- `CRON_SECRET`、`VAPID_PRIVATE_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 均不可前端 expose
- 公開可見的 env 變數需 `NEXT_PUBLIC_` 前綴明確標示

---

## 9. 核心業務流程

### 9.1 預約建立（含併發保護）
```
学員按下「預約」
    ↓
Server Action createBooking(slotId, serviceId)
    ↓
BEGIN TRANSACTION
    ↓
SELECT * FROM availability_slots WHERE id = $slotId FOR UPDATE
    ↓
檢查 status = 'available'？
   ├─ 否 → ROLLBACK → 回傳「該時段已被預約」
   └─ 是 ↓
UPDATE slots SET status = 'pending' WHERE id = $slotId
    ↓
INSERT INTO bookings (..., status = 'pending')
    ↓
INSERT INTO tenant_customers (若該學員尚未在此租戶有紀錄)
    ↓
COMMIT
    ↓
推送 Web Push 通知給教練
    ↓
回傳成功 + booking 物件
```

三重保險：
1. `SELECT ... FOR UPDATE` 行鎖防止並發讀
2. status 檢查防止重複建立
3. EXCLUDE 約束防止任何時間範圍重疊

### 9.2 重複規則物化
```
教練設定「每週二、四 19:00-21:00 連續 12 週」
    ↓
INSERT INTO recurring_rules (...)
    ↓
Server 計算未來 90 天內所有出現時間（最多 24 個）
    ↓
BEGIN
INSERT INTO availability_slots (...) VALUES (...), (...), ...
    ↓
若 EXCLUDE 約束觸發 → ROLLBACK，回傳衝突資訊
否則 → COMMIT
    ↓
回傳「已建立 24 個時段」
```

每日 00:30 由 Vercel Cron 觸發 `/api/cron/materialize-recurring`：
- 找所有 active 的 recurring_rules
- 計算「需要在第 91 天新增的 slot」（滑動視窗推進 1 天）
- 批次 INSERT，遇衝突跳過該筆並記錄 log

### 9.3 衝突偵測 + 跳轉
```
教練新增「週三 14:00-16:00」
    ↓
Server Action 嘗試 INSERT
    ↓
PostgreSQL EXCLUDE 約束發現重疊 → 拋出 23P01 錯誤
    ↓
Server Action catch 此錯誤
    ↓
SELECT * FROM availability_slots
WHERE member_id = $memberId
  AND tstzrange(start_at, end_at) && tstzrange($newStart, $newEnd)
  AND status <> 'cancelled'
    ↓
回傳結構化衝突資訊：
{
  conflicts: [
    { id, start_at, end_at, service_name, has_booking, booking_id, customer_name }
  ]
}
    ↓
UI 顯示 Modal 列出衝突，每筆有「跳轉去調整」按鈕
    ↓
按下後 → router.push(`/calendar/slot/${id}?fromConflict=1`)
```

---

## 10. UI 結構

### 10.1 重點頁面
1. **教練行事曆主畫面**（`/calendar`）
   - 日 / 週 / 月三檢視切換（預設週）
   - 顏色狀態：可預約（藍）/ 待確認（橘）/ 已確認（綠）/ 已過期（灰）
   - 右上「新增單一」與「批量 / 重複」兩按鈕

2. **批量 / 重複 Dialog**
   - 服務選擇
   - 重複方式四選（每天 / 每週 / 每月 / 每 N 天）
   - 週幾複選（圓形按鈕）
   - 起迄時間
   - 結束條件
   - 即時預覽（「將建立 N 個時段」）

3. **衝突 Modal**
   - 條列所有衝突 slot
   - 每筆右側「跳轉去調整 →」按鈕
   - 底部選項：「取消」/「略過衝突日，建立其他」

4. **學員公開預約頁**（`/[tenantSlug]`）
   - 教練資訊卡片（頭像、簡介）
   - 服務選擇
   - 日期挑選器（顯示「N 個時段」）
   - 時段選擇
   - 預約按鈕（需登入）

### 10.2 UI 元件函式庫
- **Tailwind CSS** — utility-first，最小 CSS bundle
- **shadcn/ui** — Radix UI 無樣式元件，可完全客製
- **FullCalendar** 或 **react-day-picker** — 行事曆視覺化
- **react-hook-form** + Zod — 表單管理

### 10.3 響應式
- Mobile First（學員多用手機）
- 教練後台行事曆桌面優先，但需 mobile fallback

---

## 11. 錯誤處理

### 11.1 雙軌策略
- **Server Action 內錯誤** → `safeAction` Wrapper 統一接（ExceptionFilter 等價物）
- **RSC 渲染錯誤** → `error.tsx` 邊界檔，每個路由區可有自己的友善頁面

### 11.2 錯誤類型
```ts
class AppError extends Error {
  constructor(public code: string, message: string) { super(message) }
}
class ForbiddenError extends AppError { constructor() { super('FORBIDDEN', '無權限') } }
class SlotConflictError extends AppError {
  constructor(public conflicts: Slot[]) { super('SLOT_CONFLICT', '時段衝突') }
}
class SlotUnavailableError extends AppError { constructor() { super('SLOT_UNAVAILABLE', '該時段已被預約') } }
class RateLimitError extends AppError { constructor() { super('RATE_LIMIT', '請稍後再試') } }
```

### 11.3 統一回傳結構
```ts
type ActionResult<T> =
  | { ok: true, data: T }
  | { ok: false, code: string, message: string, details?: unknown }
```

### 11.4 未知錯誤
- 寫入結構化 log（pino）
- 上報 Sentry（含 user / tenant context）
- 前端只顯示通用訊息「系統錯誤，請稍後再試」，**不洩漏內部細節**

---

## 12. 效能策略

### 12.1 500ms 預算（公開預約頁）
| 階段 | 時間 |
|------|------|
| DNS + TLS | ≤ 50ms |
| Vercel Edge 命中 | ≤ 50ms |
| RSC 渲染 + DB 查詢 | ≤ 150ms |
| HTML 下載 | ≤ 100ms |
| 解析 + 繪製 | ≤ 100ms |
| 餘裕 | 50ms |

### 12.2 技術手段
1. **Vercel Edge Network** — 台灣節點 RTT ≤ 50ms
2. **Vercel Data Cache + Tag 失效** — `revalidateTag('tenant-{slug}')` 精準失效
3. **Streaming + Suspense** — LCP 元素優先 stream
4. **資料庫索引** — `(tenant_id, member_id, start_at)`、GIST on tstzrange
5. **Supabase Pooler (pgBouncer transaction mode)** — 避免 cold start 卡連線
6. **Client Bundle 最小化** — 預設 Server Component，client 僅 ≤ 80KB (gzip)
7. **next/image (WebP/AVIF) + next/font (自託管)** — 圖片字體最佳化

### 12.3 監控
- **Vercel Speed Insights** — 真實使用者 LCP / FID / CLS
- **Vercel Analytics** — 頁面表現
- **CI Lighthouse 預算測試** — LCP 超過 500ms 警告
- **Sentry Performance** — P95 慢請求追蹤

---

## 13. 通知系統

### 13.1 排程任務
| 任務 | Cron | 行為 |
|------|------|------|
| `weekly-summary` | `0 12 * * 0` (UTC) = 週日 20:00 (UTC+8) | 寄下週預覽給有預約的使用者 |
| `daily-reminder` | `0 0-4,22-23 * * *` = 每小時 06:00-12:00 (UTC+8) | 每小時觸發；handler 內篩選 `daily_reminder_hour = 該小時` 的使用者 |
| `pre-event-reminder` | `* * * * *` = 每分鐘 | 掃描 N 分鐘後開始的預約 |
| `materialize-recurring` | `30 16 * * *` = 每日 00:30 (UTC+8) | 滑動視窗推進 1 天 |

### 13.2 Web Push 標準流程
1. 使用者登入後，前端 `Notification.requestPermission()`
2. 同意 → `navigator.serviceWorker.register('/sw.js')`
3. `ServiceWorkerRegistration.pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC_KEY })`
4. 取得 `PushSubscription` → POST `/api/push/subscribe`
5. Server 用 Zod 驗證後寫入 `push_subscriptions`

### 13.3 推送流程（範例：每日提醒）
1. Vercel Cron 呼叫 `/api/cron/daily-reminder`（帶 `Authorization: Bearer $CRON_SECRET`）
2. Handler 查詢：所有今日有預約 + 偏好啟用 + 有有效訂閱的 user
3. 為每筆組 payload（含標題、內容、deeplink）
4. 用 `web-push` 函式庫 `Promise.allSettled` 批次推送
5. 每筆寫 `notification_log`
6. 對 410 Gone 的訂閱自動刪除

### 13.4 容錯設計
- **去重**：`notification_log` 唯一鍵 `(user_id, type, related_id, scheduled_for)`
- **批次大小**：每批 100 個，超過分批，避開 Vercel function 執行時間限制
- **替代方案**：未授權 Web Push 的使用者，首頁 banner 顯示「您有 N 則未讀通知」

---

## 14. 部署與環境

### 14.1 環境
| 環境 | 用途 | DB |
|------|------|----|
| Production | 真實使用者 | Supabase production project |
| Preview | 每個 PR 自動建立 | Supabase staging project |
| Development | 本機開發 | Supabase local (Docker) 或 staging |

### 14.2 環境變數（節錄）
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY  # 僅 server 使用

# Web Push
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT  # mailto:terry@webplus.com.tw

# Cron
CRON_SECRET

# Rate Limit
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN

# Sentry
SENTRY_DSN
SENTRY_AUTH_TOKEN
```

### 14.3 Vercel 方案要求
- **Vercel Pro 計畫**（$20/月）為必要：本專案有 4 個 cron job 且包含「每分鐘」頻率，超出 Hobby 計畫限制（2 個 / 僅每日）
- Vercel KV（Upstash）免費 quota 對 MVP 階段足夠
- Sentry 免費方案足夠 5k errors/month，超量需升級

### 14.4 CI / CD
- GitHub Actions（或 Vercel Git Integration 直接觸發）
- PR 自動部署 Preview
- main 分支自動部署 Production
- 各 step：
  1. lint (eslint)
  2. type check (tsc --noEmit)
  3. test (vitest)
  4. build (next build)
  5. lighthouse budget check
  6. deploy

---

## 15. 監控與觀察

| 項目 | 工具 |
|------|------|
| 真實使用者效能 | Vercel Speed Insights |
| 頁面流量 | Vercel Analytics |
| 錯誤追蹤 | Sentry |
| 結構化 log | pino → Vercel Logs |
| DB 觀察 | Supabase Dashboard (slow query / RLS denials) |
| 排程任務狀態 | Vercel Cron Logs + notification_log 表 |

---

## 16. 後續階段（Phase 2 / 3 路線圖）

### Phase 2（MVP 上線後 1-3 個月）
- 助教多層階層（啟用 `parent_member_id`）
- CSV 匯入時段
- 教練自訂網域（CNAME + SSL）
- LINE Login + LINE Messaging API 推送
- 學員可申請改時間 → 教練同意流程
- 服務支援「線上會議連結」（透過 jsonb 預留欄位）

### Phase 3（依使用者反饋決定）
- 金流整合（Stripe Connect / ECPay / LINE Pay）
- Google Calendar 雙向同步
- 進階重複規則（例外日期、複合條件）
- 多時區支援
- iOS / Android Native App
- 教練分析儀表板（收入、熱門時段、學員回流率）
- 訂閱方案 / 平台抽成

---

## 17. 風險與已知挑戰

| 風險 | 影響 | 緩解 |
|------|------|------|
| Web Push 拒絕率高 | 通知功能效果折半 | 提供首頁 banner 作為 fallback；Phase 2 加 LINE |
| 大量並發預約導致 DB 瓶頸 | 預約失敗率上升 | EXCLUDE 約束保證正確性，Pooler + 索引保證效能；上線後監控 |
| `pre-event-reminder` 每分鐘掃描成本 | Vercel function invocation 數累積 | 用 DB index 限縮掃描範圍；如成本不可接受，改用 pg_cron |
| 教練流失導致租戶累積廢資料 | DB 體積膨脹 | 平台管理員可手動「歸檔」租戶（將資料移到 archive schema） |
| RLS 政策複雜難維護 | 易出 bug | 建立 policy 測試（用 Supabase 測試框架），CI 跑 |

---

## 18. 成功標準

| 指標 | 目標 |
|------|------|
| 公開預約頁 LCP (P75) | ≤ 500ms |
| 預約建立成功率 | ≥ 99.9%（不超賣） |
| 通知送達率 | ≥ 95%（有訂閱者） |
| 教練可在 5 分鐘內完成首次設定 | 透過 onboarding 流程 |
| 學員從進入預約頁到完成預約 | ≤ 90 秒（含登入） |

---

## 附錄 A：與原 ASP.NET Core 專案的關係

原 `WebApi/` 與 `WebApp/` 將不再延續，但**保留作為參考**直到新版上線。
原 `specs/001-b2c-booking-backend/` 規格作為 FR-001 到 FR-009 的歷史依據，新版超集。

新版啟動後，舊版可在新版穩定 30 天後標記廢棄（archive 至 `legacy/` 子目錄）。

## 附錄 B：互動稿來源

本設計透過 `superpowers:brainstorming` skill 與使用者對話收斂而成，
原始討論紀錄（含視覺化 mockup）保留於 `.superpowers/brainstorm/431-1779343574/`。
