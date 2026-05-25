# S3 — 行事曆與可用性管理設計文件

**建立日期**：2026-05-25
**狀態**：草稿（待使用者複審）
**作者**：terry@webplus.com.tw（透過 brainstorming skill 共同產出）
**Parent spec**：[`2026-05-21-quickreserve-redesign-design.md`](2026-05-21-quickreserve-redesign-design.md)（FR-120~124 將回寫到附錄 C）
**前置子專案**：S1（commit `cea8898`）、S2（commit `fc17a0a`）

---

## 1. 背景

S1/S2 把 bug + 效能 + RWD 收乾後，下一個用戶痛點：**教練無法表達「我什麼時候可以上課」與「我哪天不在」**。

目前 `recurring_rules` 表只能正面表列「重複的上課時段」，沒有反向表達「日常工作時間」與「臨時不可用」。實作上，教練若臨時請假一週，必須手動把那週的所有 slots / rules 一個個關掉；學員端也沒法看出哪些日子是「老師原本就不接課」與哪些是「老師那天沒安排但通常會上」。

S3 引入兩個正交概念來補足：

1. **作息模板（availability templates）** — 教練設定「我每週固定可上課的時段」，並支援多組模板切換（夏季作息、寒假班…）。
2. **不可用事件（unavailable events）** — 教練可任意時間區段標記為不可用（看醫生、休假、隨機）。

加上**林教練 seed 資料豐富化**用於 dev/demo 演示這兩個新功能。

---

## 2. 範圍

### 2.1 In scope

- 作息模板資料模型（templates + windows + assignments 三表）+ 教練後台 UI
- 不可用事件資料模型（單表）+ 教練後台 UI
- `effectiveAvailability(memberId, date)` 純函式 — server / cron / client 共用
- Slot / rule 建立階段加入「落在 effective range 內」驗證
- Cron `materialize-recurring` 加入 occurrence 過濾（跳過 range 外或撞 event 的）
- /calendar 主畫面：slot 撞 event 時顯示警示徽章（教練自行決定）
- 林教練 seed enrichment（模板 + recurring rule + unavailable events + collision demo）

### 2.2 Out of scope（明確排除）

- **模板 → recurring rule 自動產生**（「一鍵套用」UX 糖）→ 之後評估
- **公開頁 date strip 灰底「休」** → 之後評估；本輪 SlotPicker date strip 維持現狀（純看當日有無實際 slot）
- **撞 event 自動取消 booking** → 設計上**不**做（教練自己決定）
- **學員端「教練本週可上課時段」公開展示** → S5 教練介紹頁範圍
- **國定假日預設模板 / Holiday API 串接** → 教練自己加 unavailable_events 即可
- **多 tenant 共用模板（同一身體跨多 tenant 工作）** → 不是現實 case
- **設計系統 / 主題色 / 字型** → S6

### 2.3 成功標準（驗收 gate）

1. 教練可在 `/calendar/availability` 建立至少一組模板、設為生效、編輯每日 window
2. 教練可建立 unavailable_event（含半小時級的非整日 range）並從列表撤銷
3. 模板生效後，slot 建立 form 落在 range 外會被 server 拒絕並顯示明確 error
4. Cron `materialize-recurring` 在跑下一輪時，自動跳過超出 effective range 或撞 unavailable_event 的 occurrence
5. /calendar 主畫面，撞 event 的 slot 顯示 ⚠ 警示徽章；點開 SlotPopover 看得到「與 unavailable_event 衝突」提示
6. 林教練的 seed 資料包含至少一組模板、一條 rule、一個 unavailable_event 與一個「故意撞」的 demo case，全在 demo URL 看得到效果

### 2.4 非目標

- 大幅重構既有 `recurring_rules` 邏輯（只加 filter，不改 schema）
- 行事曆 UI 大改版（仍是 S2 的 WeekGrid / ListView，只多徽章）
- 公開頁 UX 改造（保留 S2 的 SlotPicker）

---

## 3. 資料模型

### 3.1 新增 4 張表

```sql
-- 3.1.1 作息模板
create table public.availability_templates (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.tenant_members(id) on delete cascade,
  name text not null,             -- "日常作息", "夏季作息", "週末班"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_availability_templates_member on public.availability_templates(member_id);

-- 3.1.2 模板每週時段（多 row × weekday × 多段；不列出 = 該日休）
create table public.availability_template_windows (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.availability_templates(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),  -- ISO 1=Mon..7=Sun
  start_time time not null,
  end_time time not null check (end_time > start_time)
);
create index idx_template_windows_template on public.availability_template_windows(template_id);
-- 例：(template_X, 1, 09:00, 12:00), (template_X, 1, 14:00, 17:00), (template_X, 3, 09:00, 17:00)
-- = 週一早 09-12 + 下午 14-17、週三 9-17、其他日休

-- 3.1.3 模板生效歷史（時間軸 versioning）
create table public.availability_template_assignments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.tenant_members(id) on delete cascade,
  template_id uuid not null references public.availability_templates(id) on delete restrict,
  effective_from date not null,
  created_at timestamptz not null default now()
);
create index idx_template_assignments_member_effective on
  public.availability_template_assignments(member_id, effective_from desc);
-- 「對 member m 在 date d 找 active template」=
--   select template_id from availability_template_assignments
--   where member_id = m and effective_from <= d
--   order by effective_from desc limit 1
-- 沒有任何 row = 無 working hours 限制（current behavior）

-- 3.1.4 不可用事件
create table public.unavailable_events (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.tenant_members(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null check (end_at > start_at),
  reason text,                    -- optional, e.g. "看醫生"
  created_at timestamptz not null default now()
);
create index idx_unavailable_events_member_range on
  public.unavailable_events(member_id, start_at, end_at);
```

### 3.2 RLS policies

- `availability_templates`：member 可 CRUD 自己的；tenant_owner 可 CRUD 同 tenant 任何 member 的（owner 可幫助教設）；其他 deny
- `availability_template_windows`：跟隨 template（FK 關聯）；同邏輯
- `availability_template_assignments`：同邏輯
- `unavailable_events`：member 自己 CRUD；tenant_owner 同 tenant 內全部可讀（用於 /calendar 看多人視圖時警示徽章）

**對 `availability_slots` 的影響**：無 schema 改動。建立階段加 validation，cron 加 filter，不改既有 row。

### 3.3 為什麼這樣分表

- `templates` 是命名容器，可保留多版本（夏 / 冬 / 寒假）
- `template_windows` 正規化，允許「一日多段」（早 09-12、下午 14-17，中間吃飯）
- `assignments` 是「時間軸版本控制」：切模板 = 加一筆 assignment，不刪歷史。預設一個模板無限期 = 一筆 effective_from = 模板建立日的 assignment
- `unavailable_events` 是 overlay，獨立於 templates，可隨時加

---

## 4. Effective availability 計算

### 4.1 純函式

新增 `src/lib/availability.ts`，導出：

```ts
export type Range = { start: Date; end: Date }
export type TemplateWindow = { weekday: number; start_time: string; end_time: string }

export function effectiveAvailability(args: {
  date: Date  // any moment on the target local day
  activeTemplate: { windows: TemplateWindow[] } | null
  unavailableEvents: Range[]
}): Range[]
```

**演算法**：
1. `activeTemplate === null` → 回傳 `[ { start: 該日 00:00, end: 該日 23:59:59.999 } ]`（無限制）
2. 由 activeTemplate.windows 過濾出該 weekday 的 windows → 轉成具體 Date range（套上日期）
3. 對所有 unavailable_events 與當日重疊的部分做集合減法 `subtractRanges`
4. 回傳剩下的 Range[]（可能為空 = 該日全休）

**`subtractRanges(base: Range[], cuts: Range[])`**：純函式，做區間集合減法。獨立 unit test。

### 4.2 邊界 case

- **跨午夜 unavailable event**（22:00 - 02:00 隔天）：分拆為兩段，每天分別處理
- **跨午夜 window**（不允許 — schema check `end_time > start_time` 防呆，但如業務需求出現「夜班 22:00 - 02:00」，未來再支援 split 表達）
- **時區**：所有時間統一 Asia/Taipei (UTC+8)；同 codebase 既有 `TZ_OFFSET_HOURS = 8` 慣例
- **DST**：台灣無 DST，不處理

### 4.3 server 端整合點

| 整合點 | 邏輯 |
|---|---|
| `createSlotAction` (`src/app/(tenant)/calendar/actions.ts`) | slot range 必須完全落在 `effectiveAvailability` 內，否則 throw `OUT_OF_AVAILABILITY` |
| `createRecurringRuleAction` (`recurring-actions.ts`) | 規則本身可建（不擋）；前端 preview 顯示「N 個 occurrence 將被跳過」 |
| Cron `materialize-recurring` | 對每個 occurrence 算當天 effective range；若該 occurrence 完全落在 range 外或撞 event → 跳過（不報錯） |
| `createBookingAction` (學員側) | **不**檢查（學員只能挑現有 slot，slot 是 server 控的，已過濾） |

---

## 5. UI 改動

### 5.1 新 segment：`/calendar/availability`

教練後台側邊欄「行事曆」之下加子項「可用時段」。

頁面結構（單一 page，內部 3 個 section）：

```
/calendar/availability

┌─ 作息模板（templates list） ─────────────┐
│  - 日常作息  [生效中]  [編輯] [切換為生效]│
│  - 夏季作息          [編輯] [切換為生效]│
│  + 新增模板                              │
└──────────────────────────────────────────┘

┌─ 不可用事件 ─────────────────────────────┐
│  2026-05-30 14:00-15:00  看醫生  [刪除] │
│  2026-06-01 全日         休假    [刪除] │
│  + 新增不可用事件 [全日休／半日休／自訂]  │
└──────────────────────────────────────────┘

┌─ 目前生效摘要（未來 2 週 mini calendar） ─┐
│  圖表：每日 effective range 視覺化       │
│  撞 event 的部分以紅斜線標記             │
└──────────────────────────────────────────┘
```

### 5.2 模板編輯器

點「編輯」進 Dialog（既有 base-ui Dialog pattern）：

- 模板名稱（text input）
- 7 個 row（週一 ~ 週日），每 row 可加 N 個 (start, end) 段
- 「該日休」勾選 = 該日不顯示任何 row
- 儲存：upsert 模板 + 全量替換 template_windows（先 delete 舊的，再 insert 新的）

### 5.3 切換生效模板

按鈕點開選日期：「從 YYYY-MM-DD 起生效」（預設今天）。建立一筆 assignment。歷史不刪。

**Owner 看 staff 行事曆模式（多 member 視圖）**：本輪不在此 segment 操作 staff 模板；要切去個別 staff 的 segment 編輯。複雜的 owner-as-proxy UI 留待 S4。

### 5.4 不可用事件編輯器

點「新增不可用事件」進 Dialog：

- 預設模式：「全日休」（選 N 個日期）、「半日休」（選日期 + 上/下午）、「自訂 range」（任意 start_at + end_at）
- 原因 text（optional）
- 提交時若 range 撞既有 slots → **可建**，但 dialog 顯示 warning「將與 N 個既有時段重疊（包含 M 個已預約）；建立後請自行決定要否取消那些預約」+ 「確定建立」按鈕

### 5.5 /calendar 主畫面警示徽章

WeekGrid / ListView 的 slot 上若 `start_at..end_at` 與任何 unavailable_event 重疊：

- 加 ⚠ 黃徽章
- 點開 SlotPopover 顯示「此時段與不可用事件衝突（事件原因：看醫生）」紅字提示
- 教練自行決定點「刪除時段」或保留

實作上：calendar/page.tsx 查 slots 時同步查 member 的 unavailable_events（同樣的 week range），passed down 到 CalendarPanel；client 端 join 顯示。

### 5.6 公開頁

**不動**。SlotPicker / date strip 維持現狀（看實際 slot）。理由：cron 與 server action 都已在 slot 階段過濾，公開頁不需要再算一次 effective range。日後若使用者要求「灰底休」開新 FR。

---

## 6. API + Cron 改動

### 6.1 新增 server actions

**`src/app/(tenant)/calendar/availability/actions.ts`**（per-segment colocation）：

- `createTemplateAction({ name, windows })` → 建 template + 第一筆 window batch + 自動建一筆 assignment effective_from=今天（如果是 member 第一個模板）
- `updateTemplateWindowsAction({ templateId, windows })` → 全量替換 windows
- `renameTemplateAction({ templateId, name })`
- `deleteTemplateAction({ templateId })` → cascade 刪 windows；assignments 走 RESTRICT 拒絕（先要 user 切走才能刪）
- `assignTemplateAction({ memberId, templateId, effectiveFrom })` → 加一筆 assignment

**`src/app/(tenant)/calendar/availability/unavailable-actions.ts`**：

- `createUnavailableEventAction({ startAt, endAt, reason })` → insert event
- `deleteUnavailableEventAction({ eventId })`

### 6.2 修 server actions

- `createSlotAction`：開頭加 `await validateInEffectiveRange(session.memberId, parsedInput.startAt, parsedInput.endAt)` → throw `AppError('OUT_OF_AVAILABILITY', ...)` if false
- `createRecurringRuleAction`：computeOccurrences 後加 filter 「跳過超出 effective range 或撞 event」，**但**仍 insert 全部 OK 的 occurrences；對被跳過的 occurrences 在 return value 內回報 `skippedCount`，前端顯示「N 個 occurrence 因不在可上課時段被跳過」

### 6.3 Cron `materialize-recurring`

對每個 rule 的 occurrences：
1. 算 `activeTemplate` (從 assignments 找)
2. 算當天 unavailable_events（含跨日）
3. 對每個 occurrence 呼叫 `isWithinEffectiveAvailability(...)` 過濾
4. 通過者進 batch insert（如 S2 已有的迴圈）
5. 跳過者：總計，但不報錯（cron return body 加 `out_of_availability_skipped: N`）

### 6.4 RPC / Helper

`validateInEffectiveRange(memberId, startAt, endAt): Promise<boolean>`（server lib helper，在 `src/lib/availability-server.ts`）。內部查 active template + unavailable_events，呼叫純函式 `effectiveAvailability`，回 boolean。

---

## 7. 林教練 seed enrichment

修改 `scripts/seed-test-data.mjs`：

### 7.1 模板

- **林教練 模板「日常作息」**：
  - 週一 09:00-12:00、14:00-17:00
  - 週二 14:00-20:00
  - 週三 09:00-12:00、14:00-17:00
  - 週四 14:00-20:00
  - 週五 09:00-17:00
  - 週六/日 全休
- **林教練 模板「假期作息」**（不生效）：週六/日 09:00-12:00；他日全休
- **林教練 active assignment**：「日常作息」effective_from = 今天
- **阿明助教 模板「週末班」**：週六 09:00-17:00、週日 09:00-12:00
- **阿明助教 active assignment**：「週末班」effective_from = 今天

### 7.2 Recurring rule

- 林新增 1 條：服務「網球進階班」、每週二 14:00-15:00、12 occurrences、active

### 7.3 Unavailable events

- 林：今天 +10 天的週四 14:00-15:00、reason「看醫生」（會剛好撞上面 rule 的一個 occurrence → cron 應自動跳過該 occurrence）
- 林：手動建一個 slot（已存在的 linSlots 之一，或新建一個）→ 然後建一個剛好覆蓋它的 event，reason「Demo collision」→ 在 /calendar 看到 ⚠ 警示徽章

### 7.4 修改後的 seed log 應額外列出

- 模板與 active assignment 摘要
- Unavailable events 摘要
- 「Demo collision」slot id 與對應 event id

---

## 8. 檔案異動清單

### 新增

- `supabase/migrations/202605XXXXXXXX_availability_templates_schema.sql`
- `supabase/migrations/202605XXXXXXXX_availability_templates_rls.sql`
- `supabase/migrations/202605XXXXXXXX_unavailable_events_schema.sql`
- `supabase/migrations/202605XXXXXXXX_unavailable_events_rls.sql`
- `src/lib/availability.ts`（純函式 + types）
- `src/lib/availability-server.ts`（DB-aware helper：fetch active template + events，呼叫 effectiveAvailability）
- `tests/unit/availability.test.ts`（TDD）
- `src/app/(tenant)/calendar/availability/page.tsx`（segment）
- `src/app/(tenant)/calendar/availability/loading.tsx`
- `src/app/(tenant)/calendar/availability/actions.ts`（template / assignment actions）
- `src/app/(tenant)/calendar/availability/unavailable-actions.ts`
- `src/app/(tenant)/calendar/availability/template-editor.tsx`（client component）
- `src/app/(tenant)/calendar/availability/unavailable-event-dialog.tsx`（client component）
- `src/app/(tenant)/calendar/availability/templates-section.tsx`
- `src/app/(tenant)/calendar/availability/events-section.tsx`
- `src/app/(tenant)/calendar/availability/effective-preview.tsx`（mini calendar 視覺化）
- `docs/superpowers/specs/2026-05-25-s3-availability-design.md`（本 spec）

### 修改

- `src/lib/supabase/types.ts`（regen 後新表 row types）
- `src/app/(tenant)/calendar/actions.ts`（createSlotAction 加 validateInEffectiveRange）
- `src/app/(tenant)/calendar/recurring-actions.ts`（createRule 計算 skippedCount）
- `src/app/api/cron/materialize-recurring/route.ts`（occurrence filter）
- `src/app/(tenant)/calendar/page.tsx`（多查 unavailable_events，passed down）
- `src/app/(tenant)/calendar/calendar-panel.tsx`（receive events，傳給 WeekGrid / ListView）
- `src/app/(tenant)/calendar/week-grid.tsx`（slot 撞 event 顯示徽章）
- `src/app/(tenant)/calendar/list-view.tsx`（同上）
- `src/app/(tenant)/calendar/slot-popover.tsx`（衝突提示）
- `src/components/tenant-sidebar.tsx`（如存在）— 加「可用時段」連結
- `scripts/seed-test-data.mjs`（豐富 林 + 阿明 資料）
- `README.md`（路由地圖加 `/calendar/availability`）
- `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md` 附錄 C 加 FR-120~124

---

## 9. 風險與緩解

| 風險 | 機率 | 緩解 |
|---|---|---|
| Effective availability 算錯（時區 / 跨午夜 event） | 中 | `availability.ts` 走 TDD；單元測試覆蓋跨午夜 event、weekday 邊界、空 window |
| 模板 assignments 切換時間軸混亂（多筆 effective_from 排序錯） | 中 | 查詢限制「effective_from <= today order by desc limit 1」；index 覆蓋 |
| Cron 跑很久（多 rule × 90 occurrence × 雙重 filter） | 低 | 既有 90 天 window 限制規模；filter in-memory；每 rule 查一次 events |
| 教練建 event 撞 existing slot 後忘了刪 → 學員照樣 booking | 中 | UI 在 /calendar 顯示明顯 ⚠ 警示徽章 + SlotPopover 提示；非 server 強制（保彈性） |
| RLS 寫錯（staff 改到別人模板） | 中 | RLS policy 跟既有 `tenant_members` 一樣的 pattern；測試 staff-isolation case |
| 公開頁 date strip 沒灰底「休」造成學員疑惑 | 低 | 本輪不修；如 user feedback 痛點再開新 FR |
| Seed 跑兩次資料重疊 | 低 | 既有 cleanup 邏輯先刪 demo-* tenant；新表 cascade 跟著清 |

---

## 10. FR 編號（回寫 parent spec 附錄 C）

- **FR-120**：作息模板（availability_templates + windows + assignments）schema + 教練後台編輯 UI + 切換生效
- **FR-121**：unavailable_events schema + 教練後台 UI（含全日/半日/自訂 range presets）
- **FR-122**：`effectiveAvailability` 純函式 + server action 整合（createSlot / createRule 過濾）+ cron 過濾 occurrence
- **FR-123**：/calendar 主畫面 slot 撞 unavailable_event 警示徽章 + SlotPopover 衝突提示
- **FR-124**：林教練 seed enrichment（模板 + rule + events + collision demo）

---

## 11. doc 更新清單（按 [feedback-docs-after-impl] memory）

- `README.md`：路由地圖加 `/calendar/availability`、加「可用時段」概念說明節
- `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md` 附錄 C：FR-120~124 條目 + commit hash 回填
- 不需要新增 audit 文件（不是效能或 RWD 子專案）

---

## 12. 後續

完成本 spec → 交棒 writing-plans skill → 產出 task 分解 plan → 實作 → commit hash 回寫附錄 C。S3 完成後接 S4（服務與商品模型擴充：團班最少人數、套裝課程、軟刪除規範化）。
