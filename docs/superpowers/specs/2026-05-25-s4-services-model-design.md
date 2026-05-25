# S4 — 服務與商品模型擴充設計文件

**建立日期**：2026-05-25
**狀態**：草稿（待使用者複審）
**作者**：terry@webplus.com.tw（透過 brainstorming skill 共同產出）
**Parent spec**：[`2026-05-21-quickreserve-redesign-design.md`](2026-05-21-quickreserve-redesign-design.md)（FR-125~130 將回寫到附錄 C）
**前置子專案**：S1（`cea8898`）、S2（`fc17a0a`）、S3（`045b939`）

---

## 1. 背景

S1-S3 把 bug、效能 + RWD、可用時段管理 都解了。當下還有三個尚未補上的核心商業缺角：

1. **教練不能定義「課數」商品**：所有 booking 都是付費未知的單次行為，無法表達「10 堂套裝 $8000」之類常見方案。學員 retention 低、coach 收款也亂。
2. **無法表達「團班需要最少 4 人才開」**：行事曆只能跑 1-on-1；團體課程必須教練自己 offline 通知學員 + 手動取消。
3. **`is_active` 同時表達「暫停」與「刪除」**：UI 上稱「停用」、code 內當「軟刪除」用，意圖不明確；既有的 `is_active=false` 服務 學員一律看不到、但 admin 端也找不回「真的不要了」與「只是暫時收起來」的差別。

本子專案統一處理這三件事。

---

## 2. 範圍

### 2.1 In scope

- **套裝 / 課數模型**（FR-125, FR-126, FR-127）
  - 教練可以為每個 service 定義多個 packages（含「單堂」= class_count=1）
  - 學員可申請購買、自報已付/未付、教練審核
  - Booking 強制經過 purchase（無 confirmed-active purchase 則 redirect 購買頁）
- **團班最少人數**（FR-128, FR-129）
  - Service 加 `max_capacity` / `min_attendance` / `cancel_deadline_hours`
  - 達 min → 自動 confirm + 通知；過 deadline 不足 min → 自動 cancel + 退課數 + 通知
- **軟刪除規範化**（FR-130）
  - 確認 `is_active=false` 唯一語意「軟刪除（已下架）」
  - UI 改寫「刪除 / 重新啟用」+ 已刪除分頁
  - 全 codebase audit `is_active` filter 正確套用

### 2.2 Out of scope（明確排除）

- **金流整合**（TapPay / LinePay / 信用卡）→ S7+。目前 payment_self_reported 由學員勾、教練審核
- **跨 service package**（「10 堂任選課」橫跨多 service）→ 之後評估
- **Refund / credit memo 等財務文件**：教練可手動調整 classes_total 但無正式財務流
- **Customer / tenant 軟刪除**：已有 status enum 處理
- **「未來預訂的 booking 取消後 balance 怎麼處理」**：暫定 → classes_used--（退一堂）；其他狀況用 issue 追蹤
- **公開頁顯示「X/Y 已預約」**：教練後台先做；公開頁 sees only 名額未滿的 slot

### 2.3 成功標準

1. 教練可在 `/packages` 為「網球初級」建立兩個 package（單堂 1200、10 堂 10000，180 天有效期）
2. 學員可在 `/[tenantSlug]/packages` 提交購買申請、自報已付款
3. 教練於 `/packages/pending` 看到請求、確認後學員 balance = 10
4. 學員預約 slot：自動扣 1 堂、balance = 9
5. 學員無 balance 時，`/book/[slotId]` 顯示「需購買套裝」CTA 而非錯誤
6. 教練設 service 為團班（capacity=8, min=4, deadline=24h）：第 4 個學員 book 後，前 3 個 booking 全部 confirmed + 學員收通知
7. 同 slot 若預約截止前不足 4 人：cron 取消 slot + 所有 booking + 退課數 + 通知所有人
8. 教練於 `/services` 「刪除」一個服務：學員端不再看到、教練端「已刪除」分頁仍可重新啟用

### 2.4 非目標

- 100% 設計感的學員端購買頁（先功能對、後 polish）
- 退款工作流（refund_at / refund_reason 等欄位先不加；教練手動調 classes_total）

---

## 3. 套裝 / 課數 資料模型

### 3.1 新表

```sql
-- 3.1.1 service_packages：教練定義的套裝
create table public.service_packages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  name text not null,                                  -- "10 堂套裝"、"單堂"
  class_count int not null check (class_count >= 1),
  price numeric(10, 2) not null check (price >= 0),
  expires_in_days int check (expires_in_days is null or expires_in_days > 0),  -- null = 永久
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_service_packages_service on public.service_packages(service_id, is_active);

-- 3.1.2 customer_purchases：學員的購買記錄（單堂與套裝都用同表）
create table public.customer_purchases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  service_id uuid not null references public.services(id),
  package_id uuid references public.service_packages(id),    -- 來源 package；可空（手動建的）
  classes_total int not null check (classes_total >= 1),
  classes_used int not null default 0
    check (classes_used >= 0 and classes_used <= classes_total),
  expires_at timestamptz,                                    -- null = 永久
  payment_self_reported text not null
    check (payment_self_reported in ('claimed_paid', 'awaiting_payment')),
  approval_status text not null default 'pending_review'
    check (approval_status in ('pending_review', 'confirmed', 'rejected')),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  rejected_reason text,
  created_at timestamptz not null default now()
);
create index idx_customer_purchases_lookup
  on public.customer_purchases(customer_id, service_id, approval_status, expires_at);
create index idx_customer_purchases_tenant_pending
  on public.customer_purchases(tenant_id, approval_status)
  where approval_status = 'pending_review';
```

### 3.2 bookings 加 FK

```sql
alter table public.bookings
  add column purchase_id uuid references public.customer_purchases(id);
-- 先 nullable，跑 backfill 後再 set NOT NULL（見 §3.4 migration order）
```

### 3.3 RLS policies（粗略；migration 內詳列）

- `service_packages`: tenant_member SELECT / CRUD 自家 tenant；public SELECT 限 `is_active=true` 給學員端瀏覽
- `customer_purchases`:
  - SELECT: customer 看自己；tenant_member 看自家所有；admin 看全部
  - INSERT: customer 可建（強制 approval_status='pending_review'）；tenant_member 也可代建（直接 'confirmed'）
  - UPDATE: 只有 tenant_member 可改 approval_status / approved_at / approved_by / rejected_reason / classes_total（手動加減課數）；其他欄位 immutable

### 3.4 Migration 順序

1. `service_packages` schema + RLS（兩個 migration 檔）
2. `customer_purchases` schema + RLS（兩個 migration 檔）
3. `alter bookings add column purchase_id`（nullable）
4. **Backfill data migration**：對每個既有 booking，建立一筆 synthetic purchase（classes_total=1, used=1, approval_status='confirmed', payment_self_reported='claimed_paid', expires_at=null, package_id=null），把 booking.purchase_id 填上
5. `alter bookings alter column purchase_id set not null`
6. (團班所需) drop `bookings_slot_unique_active`，建立 `bookings_slot_customer_unique`
7. (團班所需) alter services 加 max_capacity / min_attendance / cancel_deadline_hours

### 3.5 expires_at 計算

`customer_purchases.expires_at` 在 approval 時計算：

```ts
if (purchase.package_id) {
  const pkg = await fetchPackage(purchase.package_id)
  if (pkg.expires_in_days != null) {
    expires_at = approved_at + pkg.expires_in_days * 24 * 3600 * 1000  // UTC
  } else {
    expires_at = null  // 永久
  }
} else {
  // 手動建的 ad-hoc purchase；UI 表單 提供 expires_at picker，可填或空
}
```

**注意**：以 `approved_at` 為起算點（非 `created_at`），避免「教練拖了 1 個月才審核」造成有效期變短的爭議。

### 3.6 「Active purchase」定義

```ts
function isActive(p: CustomerPurchase, now: Date): boolean {
  return p.approval_status === 'confirmed'
    && p.classes_used < p.classes_total
    && (p.expires_at === null || p.expires_at > now)
}
```

### 3.7 Booking 扣抵演算法

當學員建立新 booking 對 service S：

```ts
const candidates = await supabase
  .from('customer_purchases')
  .select('*')
  .eq('customer_id', customerId)
  .eq('service_id', serviceId)
  .eq('approval_status', 'confirmed')
  .lt('classes_used', supabase.raw('classes_total'))   // 還有餘額
  .or('expires_at.is.null,expires_at.gt.now()')
  .order('expires_at', { ascending: true, nullsFirst: false })  // 最快過期的先用
  .order('approved_at', { ascending: true })           // 同期則最早審核的先用
  .limit(1)
  .maybeSingle()

if (!candidates) throw new AppError('NO_BALANCE', '需先購買套裝才能預約')

// Atomic via SQL function: increment classes_used + insert booking with purchase_id
// (建一個 RPC `book_with_purchase` 包裝兩步)
```

排序原則：**最快過期 → 最早 approved**。確保學員不會因為買了新套裝後、舊套裝 expires_at 過了才發現「啊先扣完舊的」。

### 3.8 Booking 取消時的 balance 處理

- Booking status='cancelled' → 對應 purchase 的 classes_used--
- 教練端取消 / 學員端取消 / cron auto-cancel 同邏輯
- 透過 SQL trigger 或 server action 處理（不要重複實作；包進 RPC）

---

## 4. 團班 model

### 4.1 Schema 改動

```sql
alter table public.services
  add column max_capacity int not null default 1 check (max_capacity >= 1),
  add column min_attendance int not null default 1
    check (min_attendance >= 1 and min_attendance <= max_capacity),
  add column cancel_deadline_hours int not null default 24
    check (cancel_deadline_hours >= 0);

drop index bookings_slot_unique_active;
create unique index bookings_slot_customer_unique
  on public.bookings(slot_id, customer_id)
  where status <> 'cancelled';
```

**預設 1/1**：既有所有 service 都是 1-on-1，行為不變。

### 4.2 Booking insertion 驗證

於 `createBookingAction`（學員側）：

```ts
const { count } = await supabase
  .from('bookings')
  .select('id', { count: 'exact', head: true })
  .eq('slot_id', slotId)
  .neq('status', 'cancelled')
const service = await fetchServiceOfSlot(slotId)
if (count >= service.max_capacity) {
  throw new AppError('SLOT_FULL', '此時段名額已滿')
}
// ... insert booking ...
// After insert:
if (count + 1 >= service.min_attendance) {
  // Bulk confirm all bookings in this slot
  await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('slot_id', slotId)
    .neq('status', 'cancelled')
  // Trigger notification to all booking customers
}
```

**Race 處理**：用 RPC `book_with_purchase`（新；替代既有 `book_slot_atomic`），內部 `SELECT ... FROM availability_slots WHERE id = p_slot_id FOR UPDATE` lock 該 slot row，再 count、check capacity、insert booking、increment classes_used，全部包在同一 transaction。確保 4 個併發 insert 第 4 名額時不會超賣。

### 4.3 Auto-cancel cron

新檔：`src/app/api/cron/auto-cancel-group-class/route.ts`

```ts
// 每小時跑：找未來 [now, now + maxDeadline] 內的 slot
// maxDeadline = max(services.cancel_deadline_hours)
const slots = await admin
  .from('availability_slots')
  .select('id, service_id, start_at, services(min_attendance, cancel_deadline_hours)')
  .gte('start_at', now)
  .lt('start_at', new Date(now.getTime() + 48 * 3600 * 1000))  // 48h 上限 batch
  .neq('status', 'cancelled')

for (const slot of slots) {
  const svc = slot.services
  const hoursToStart = (new Date(slot.start_at).getTime() - now.getTime()) / 3600000
  if (hoursToStart > svc.cancel_deadline_hours) continue
  if (svc.min_attendance <= 1) continue  // 1-on-1 跳過

  const { count } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('slot_id', slot.id)
    .neq('status', 'cancelled')

  if (count < svc.min_attendance) {
    // 1. cancel slot
    // 2. cancel all bookings → status='cancelled'
    // 3. refund balance: per booking, decrement purchase.classes_used
    // 4. notify all customers + the coach
    // Wrap in RPC `auto_cancel_group_slot(slot_id)` for atomicity
  }
}
```

Vercel cron 設每小時 0 分跑 → `cancel_deadline_hours` 最小可用值 = 1（小於 1 cron 可能來不及 fire）。Spec 明示「最小 1 小時」。

### 4.4 通知模板（沿用既有 notification system）

| 事件 | 對象 | 內容 |
|---|---|---|
| 達 min 自動 confirm | 該 slot 所有 booking 學員 | 「[Service] 已達開課人數，課程確認」 |
| 達 deadline 自動 cancel | 該 slot 所有 booking 學員 + 教練 | 「[Service] 人數不足，課程已取消。已退還 1 堂課數」 |

Push notification 內容用既有 notify-booking.ts pattern。

### 4.5 教練手動取消團班

UI 沿用既有 `/calendar` slot popover 的「刪除時段」按鈕；server 改為 RPC `auto_cancel_group_slot`（同上、抽出來重用）。

---

## 5. 軟刪除規範化（FR-130）

### 5.1 原則

`is_active=false` ≡ **軟刪除（已下架）**。本系統不再區分「暫停」與「刪除」。

### 5.2 影響的表

- `services`
- `recurring_rules`
- 新增的 `service_packages`

(其他表如 `tenants` / `tenant_members` / `customers` 各有自己的 status enum，本輪不動)

### 5.3 Code audit checklist

| 路徑 | 應否 filter is_active=true | 現狀 |
|---|---|---|
| `[tenantSlug]/page.tsx`（公開頁 services list） | ✓ | 已 filter（既有）|
| `/api/public/slots`（公開時段 query） | n/a（不查 services） | 既有 |
| `/services`（教練後台 services list） | 預設 only `true`，加 toggle 看 `false` | 改寫 |
| `/calendar` NewSlotDialog services dropdown | ✓ | 確認 |
| `/calendar` RecurringRuleDialog services dropdown | ✓ | 確認 |
| `/customers/[id]` 顯示學員過去 bookings | 不 filter（歷史完整性） | 確認 |
| `/packages` 教練後台 packages list | 預設 only `true`，加 toggle 看 `false` | 新建 |
| 學員 `/[tenantSlug]/packages` 公開瀏覽 | ✓（only 顯示 active） | 新建 |

### 5.4 UI 改動

**Services 列表**：
- 「停用 / 啟用」按鈕改「刪除 / 重新啟用」
- 預設 tab「使用中」（is_active=true）+ tab「已刪除」（is_active=false）
- 刪除 confirmation：「此服務將不再出現在學員預約列表。既有預約與套裝不受影響。可從『已刪除』分頁重新啟用。」

**Recurring rules / packages 同模式**：沿用相同 UI 慣例。

---

## 6. 預約流程改動

完整流程：

```
學員 點 slot in 公開頁 → /book/[slotId]
  ↓
Server checks:
  1. Slot status='available' AND start_at > now → 進
  2. count(bookings non-cancelled) < service.max_capacity → 進，否則 SLOT_FULL
  3. 學員有 active confirmed purchase for service → 進
     沒有 → return 'NO_BALANCE' 顯示頁面：
         「您尚未持有 [Service] 的套裝。可購買的方案：
          - [Package list with class_count + price + 有效期]
          - [立即購買] 按鈕」
  4. 建立 booking with purchase_id=oldest valid purchase
     classes_used++（atomic via RPC）
  5. count after insert >= min_attendance：
        bulk confirm 所有 pending bookings in this slot
        通知所有人
     else：booking.status='pending'，等其他人 join 或 cron 處理
  6. Redirect → /my-bookings
```

學員購買流程：

```
/[tenantSlug]/packages → 列出 service's active packages
學員選一個 → fill 「已付款 / 未付款」 self-report → submit
  → customer_purchases.insert(approval_status='pending_review', payment_self_reported=X)
  → 通知教練（push）「[學員] 申請購買 [Package]，自報 [已/未] 付款」
  → toast「已送出，請等教練確認」
  → redirect /[tenantSlug]/purchases（看自己的 pending + confirmed 記錄）

/packages/pending（教練端）：
  顯示所有 pending_review，依 service / customer 分組
  每筆 row 顯示：學員、Package 名、自報狀態、申請時間
  動作：
    - 「確認」→ approval_status='confirmed', approved_at=now,
              expires_at = now + package.expires_in_days * 24h (or null)
              push notify 學員「您的 [Package] 已確認，可立即預約」
    - 「拒絕」→ approval_status='rejected', rejected_reason 必填
              push notify 學員「您的 [Package] 申請被拒絕：[reason]」
```

---

## 7. UI 改動清單

### 新增

- `/[tenantSlug]/packages` — 學員瀏覽 + 申請購買（公開頁，需 login）
- `/[tenantSlug]/purchases` — 學員看自己的購買記錄與餘額
- `/packages` — 教練後台 packages 管理（CRUD package definitions）
- `/packages/pending` — 教練 pending purchase request 隊列
- `/customers/[id]/packages` 子分頁 — 看單一學員的 purchase 與餘額（教練端）

### 修改

- `/services` — 加 service form fields（capacity / min / deadline）；加「已刪除」分頁；「停用」按鈕改「刪除」
- `/calendar` — SlotPopover 顯示「X/Y 已預約」(若 max_capacity>1)
- `/book/[slotId]` — 加 balance check + 「需購買套裝」CTA
- 側邊欄 sidebar-nav.tsx — 加「套裝管理」連結（教練）
- 學員側 my-bookings — 顯示「使用 X 套裝 (餘 Y/N 堂)」

---

## 8. 檔案異動清單

### 新增

**Migrations**（7 個 SQL 檔，按順序）：
- `20260525200000_service_packages_schema.sql`
- `20260525200001_service_packages_rls.sql`
- `20260525200002_customer_purchases_schema.sql`
- `20260525200003_customer_purchases_rls.sql`
- `20260525200004_bookings_add_purchase_id.sql` (nullable)
- `20260525200005_backfill_synthetic_purchases.sql` (data migration)
- `20260525200006_bookings_purchase_id_not_null.sql`
- `20260525200007_services_group_class_columns.sql`
- `20260525200008_bookings_slot_customer_unique.sql`
- `20260525200009_rpc_book_with_purchase.sql` (RPC + 改寫 book_slot_atomic)
- `20260525200010_rpc_auto_cancel_group_slot.sql` (新 RPC)

**Code**:
- `src/lib/purchases.ts` — `isActive`, `findActivePurchaseForBooking` 純函式
- `src/lib/purchases-server.ts` — server helpers
- `tests/unit/purchases.test.ts`
- `src/app/(tenant)/packages/page.tsx` — 套裝管理 list
- `src/app/(tenant)/packages/loading.tsx`
- `src/app/(tenant)/packages/actions.ts` — create / update / delete (is_active=false) / restore
- `src/app/(tenant)/packages/package-form.tsx` — client component dialog
- `src/app/(tenant)/packages/pending/page.tsx` — pending purchase queue
- `src/app/(tenant)/packages/pending/loading.tsx`
- `src/app/(tenant)/packages/pending/purchase-actions.ts` — approve / reject
- `src/app/(tenant)/customers/[id]/packages/page.tsx` 或同 customers/[id] page 加 section
- `src/app/[tenantSlug]/packages/page.tsx` — 學員端瀏覽
- `src/app/[tenantSlug]/packages/loading.tsx`
- `src/app/[tenantSlug]/packages/purchase-request-form.tsx` — client component
- `src/app/[tenantSlug]/packages/purchase-request-action.ts`
- `src/app/[tenantSlug]/purchases/page.tsx` — 學員看自己的餘額
- `src/app/[tenantSlug]/purchases/loading.tsx`
- `src/app/api/cron/auto-cancel-group-class/route.ts` — 新 cron
- `src/app/(tenant)/services/service-form-group-fields.tsx` — capacity / min / deadline 子表單

### 修改

- `src/lib/supabase/types.ts` — regen 後新表 types
- `src/app/(tenant)/services/page.tsx` — 加分頁、改按鈕語意
- `src/app/(tenant)/services/services-table.tsx`（若有） — 加「刪除 / 重新啟用」按鈕
- `src/app/(tenant)/services/actions.ts` — 加 deleteService（soft）/ restoreService actions；form schema 加 capacity / min / deadline
- `src/app/book/[slotId]/page.tsx` — balance check + 「需購買」分支
- `src/app/book/[slotId]/actions.ts` — `createBookingAction` 改走 `book_with_purchase` RPC
- `src/app/(tenant)/calendar/slot-popover.tsx` — 顯示「X/Y 已預約」
- `src/app/(tenant)/calendar/page.tsx` — slots query 加 service capacity 資料
- `src/app/(tenant)/calendar/week-grid.tsx` — slot 上顯示「3/8」當 max_capacity > 1
- `src/app/(tenant)/sidebar-nav.tsx` — 加「套裝管理」連結
- `src/app/(customer)/my-bookings/page.tsx` — 顯示套裝來源
- `src/lib/notify-booking.ts` — 加 group-confirm / group-cancel 通知 types
- `scripts/seed-test-data.mjs` — bookSlot helper 改為先建 purchase 再 book；新增 demo packages for 林教練
- Vercel cron 配置（`vercel.json` 或同等）— 加 auto-cancel-group-class hourly
- `README.md` — 加「套裝 / 課數模型」與「團班」說明節
- `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md` 附錄 C — 加 FR-125~130

---

## 9. FR 編號

- **FR-125**: `service_packages` schema + 教練 `/packages` CRUD UI + 軟刪除（is_active）
- **FR-126**: `customer_purchases` schema + 學員申請 + 教練 `/packages/pending` 審核 + 通知
- **FR-127**: 預約流程強制經過 purchase（無 balance → 引導購買）；扣抵與取消退課數
- **FR-128**: services 加 `max_capacity` / `min_attendance` / `cancel_deadline_hours` + UI 表單
- **FR-129**: 團班 booking auto-confirm（達 min）+ 新 cron auto-cancel（過 deadline 不足 min）+ 雙向通知
- **FR-130**: `is_active` 軟刪除語意統一 + `/services` 與 `/packages` 加「已刪除」分頁 + 「刪除 / 重新啟用」按鈕

---

## 10. 風險與緩解

| 風險 | 機率 | 緩解 |
|---|---|---|
| Bookings backfill migration 出錯導致既有 booking 損失 | 高 | (a) 跑前 `pg_dump` 備份；(b) backfill SQL 用 transaction 包；(c) staging 先測；(d) 若失敗可 `delete from customer_purchases where created_at >= 'migration_start_at'` 再 `alter table bookings drop column purchase_id` 回滾 |
| Drop slot unique index 失去保護、超賣 | 高 | (a) 新 composite unique 仍擋同一 customer 重複預約；(b) capacity check 在 RPC 內 `select ... for update` + 重新 count |
| Cron 跑頻不夠、cancel_deadline=1h 失效 | 中 | spec 明示「最小 deadline = 1h」；UI form 加 `min={1}`；cron hourly 設 0 分跑 |
| Expires_at 算錯（時區） | 中 | 全 UTC 計算；測試覆蓋 +08:00 邊界 |
| 套裝 customer_purchases 大量資料 query 慢 | 低 | 索引 `(customer_id, service_id, approval_status, expires_at)` 涵蓋扣抵查詢 |
| 教練 reject 後學員可再申請 | 中 | 允許（business decision）；後端不擋；UI 可選擇隱藏 rejected 記錄但 admin 看得到 |
| 學員無 balance 點 slot 體驗差 | 中 | 「需購買套裝」頁面顯示完整 package list + 一鍵申請；考慮在 SlotPicker 加 hint「您尚未持有套裝」 |
| 團班 race 同時 4 個學員 book 第 4 名額 | 中 | RPC `book_with_purchase` 內 `SELECT ... FOR UPDATE` lock availability_slots row；測試覆蓋並發（integration test 跑 4 個 concurrent client） |
| RLS policy 多表 join 寫錯導致權限漏洞 | 中 | 整合測試覆蓋 staff-isolation 對所有新表 |

---

## 11. doc 更新清單（按 [feedback-docs-after-impl] memory）

- `README.md`：加「套裝 / 課數模型」與「團班」說明節
- `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md` 附錄 C：FR-125~130 條目 + commit hash
- 不需新增 audit 文件

---

## 12. 後續

完成本 spec → invoke writing-plans → 產 plan → subagent-driven 執行 → commit hash 回寫附錄 C。S4 完成後接 S5（教練介紹頁 photos/videos）。
