# S2 — 效能與 RWD 設計文件

**建立日期**：2026-05-24
**狀態**：草稿（待使用者複審）
**作者**：terry@webplus.com.tw（透過 brainstorming skill 共同產出）
**Parent spec**：[`2026-05-21-quickreserve-redesign-design.md`](2026-05-21-quickreserve-redesign-design.md)（FR-115~119 將回寫到附錄 C）
**前置子專案**：S1（已完成，commit `cea8898`）

---

## 1. 背景

S1 已修四個緊急 bug 並把 `(platform)` 群組補上 loading skeleton，但使用者實際操作後仍報出三個明顯的卡頓點：

1. 教練後台行事曆「週 / 日 / 列表」視圖切換很慢
2. 學員公開頁服務 / 日期切換超卡
3. 學員預約流程也卡

加上原始清單還包含「全站需要 RWD」「所有操作都要在 500ms 內」兩條跨層級要求。本子專案集中處理這兩塊。

---

## 2. 範圍

### 2.1 In scope

- **三條重點路徑**深挖修法：
  - 路徑 A：教練後台 `/calendar` 視圖切換
  - 路徑 B：學員公開頁 `/[tenantSlug]` service / date 切換
  - 路徑 C：`/platform/tenants` 載入感知（S1 已加 skeleton，本輪量測 + Suspense 切塊）
- **全站 loading.tsx 普及**：13 個 route 補 skeleton
- **`<PublicPageSkeleton>` 客製元件**：公開頁專屬骨架（hero + service grid 排版）
- **Suspense 切塊**：heavy server query 處用 `<Suspense>` boundary，先送 HTML 框架再 stream 資料
- **RWD audit**：375×667（iPhone SE）+ 768×1024（iPad mini）每路徑走過一遍，紀錄並修問題
- **量測 + exception 清冊**：production warm hit 中位數量測，無法 < 500ms 的 route 明確列入 exception

### 2.2 Out of scope（明確排除，避免 scope creep）

- DB query cache（`unstable_cache` / Vercel Runtime Cache 包整個 query）→ S6 架構 review
- Edge runtime 改造 → S6
- Bundle size 大幅削減（lucide tree-shaking、改 inline SVG 等）→ S6
- a11y `aria-busy` / `prefers-reduced-motion` → S6 設計系統 review
- 設計系統主題色 / 字型統一 → S6
- 行事曆批量設定 / unavailable events / 套裝課程 / 教練介紹頁 → S3、S4、S5

### 2.3 成功標準（驗收 gate）

1. 三條重點路徑的 **warm click-to-data 中位數 ≤ 500ms**（production 量測，第 3-5 次取中位）
2. 全站每個 route **點按後 100ms 內出現 skeleton 或部分內容**
3. **375px viewport audit 完整跑過、無 P1 issue**（橫向 scroll / 按鈕不可點 / dialog 爆出 viewport / 表格無法閱讀）
4. **`docs/s2-perf-measurements.md` exception 清冊存在**，內容可以不為空（重點是知道哪些超標 + 為什麼 + 何時處理）

### 2.4 非目標（明確不追求）

- 冷啟動 500ms（Vercel function cold start 200–500ms + Supabase 連線 ~100ms + render，第一次訪問就是做不到）
- Lighthouse 100 分（追求這個會擠到 S6 才做的工作）
- 桌面（≥ 1024px）視覺重設計（沿用既有設計）

---

## 3. 路徑 A — 行事曆視圖切換

### 3.1 現狀

`src/app/(tenant)/calendar/view-tabs.tsx` 使用 `<Link href="?view=day">` 做 view 切換，等於整頁 navigation。Server component 重新 await slots / members / rules，HTML 才送出，期間白屏。

### 3.2 修法

把 view 切換改成 **local UI state + 共用資料**：

- 抽 `src/app/(tenant)/calendar/calendar-panel.tsx`（**client component**）：吃 server 拉好的 `slots`、`members`、`rules`，內部 `useState<'week'|'day'|'list'>` 切視圖，純前端重排，不發 request
- URL `?view=` 用 `useRouter().replace`（**不** push，避免 history 爆炸）做 deep link 同步，**不**觸發 server re-fetch
- 同一份資料三種視圖：`<WeekGrid>` / `<DayGrid>` / `<ListView>` 三個 client 元件，型別共用，由 `<CalendarPanel>` 條件渲染
- 「換週」「換日」這種改 date range 的操作仍走 server fetch（必要的資料變動），但加 `loading.tsx` skeleton 提供即時回饋

### 3.3 驗收

- 點視圖 tab 後 < 50ms 視圖切換完成（純客戶端操作）
- 換日期 / 週仍走 server fetch，warm hit < 500ms 出現新資料
- URL `?view=day` 可分享，深連結直接打開正確 view

---

## 4. 路徑 B — 學員公開頁服務 / 日期切換

### 4.1 現狀

`src/app/[tenantSlug]/page.tsx` 是 Server Component，`?service=X&date=Y` 改變 → 整頁 navigation → server 重 await tenant、services、slots → 白屏。

### 4.2 修法

**hero 維持 server-rendered，slot picker 改 client + CDN-cached API**：

- 維持 server-rendered 的「教練 hero + 服務清單」（很少變動）
- 抽 `src/app/[tenantSlug]/slot-picker.tsx`（**client component**）：吃 `tenantId` + `serviceId` props，自己用 `fetch` 從新增的 API route 拉時段
- 新增 `src/app/api/public/slots/route.ts`：query params `tenantId`、`serviceId`、`date`，回傳當日 `availability_slots`。Response headers `Cache-Control: s-maxage=60, stale-while-revalidate=300`，讓 Vercel/CDN 邊緣快取 60 秒
- 切服務 / 日期：slot picker 自己更新 URL（`router.replace`）+ 自己重抓
- 教練端寫入時段時，server action 呼叫 `revalidateTag('public-slots-' + tenantId)` 主動失效

### 4.3 為什麼 API route 而非 server action

- server action 不能被 CDN cache
- API route 加 `s-maxage` 後可吃 Vercel Edge cache，多個學員同時查同一教練 → 第二人之後從 edge 拿，幾乎瞬時
- 60 秒 stale 對「教練可用時段」可接受，且寫入時主動 invalidate

### 4.4 驗收

- 點日期 / 服務後 < 100ms 出現 skeleton
- warm hit（cache hit）資料 < 200ms 出現
- cold hit（cache miss）資料 < 500ms 出現
- 教練新增時段後，學員端 < 5 秒看到（revalidateTag 廣播延遲）

---

## 5. 路徑 C — `/platform/tenants` 載入

### 5.1 現狀

S1 已加 `loading.tsx` skeleton。實際 query：
- 冷查詢 ~700ms（Supabase 連線初始化）
- 熱查詢 ~150ms（兩 query 加總）

### 5.2 修法

- **量測一輪**：用 dev tools server timing 確認瓶頸是 Supabase 連線而非 query
- 若確認是冷連線：將 page.tsx 拆為 Suspense boundary：
  - **先 stream 邀請表單**（無 query，瞬時可渲染）
  - **再 stream 租戶列表**（query 完才渲染）
- **不加 query cache**：租戶列表是平台 admin 寫操作核心畫面，stale 5 秒會搞混人

### 5.3 驗收

- 邀請表單 < 200ms 渲染（可開始打字）
- 列表 < 700ms 進來
- user 不再感覺白屏

---

## 6. 全站 loading.tsx 普及

### 6.1 補齊清單

| Route | rows | withHeader | 備註 |
|---|---|---|---|
| `(tenant)/dashboard` | 4 | ✓ | |
| `(tenant)/calendar` | 7 | ✓ | grid 占大塊 |
| `(tenant)/calendar/rules` | 4 | ✓ | |
| `(tenant)/bookings` | 8 | ✓ | 列表常見 8 行 |
| `(tenant)/services` | 5 | ✓ | |
| `(tenant)/customers` | 6 | ✓ | |
| `(tenant)/staff` | 4 | ✓ | |
| `(tenant)/settings/profile` | 3 | ✓ | |
| `(tenant)/notifications` | 3 | ✓ | |
| `(customer)/my-bookings` | 6 | ✓ | |
| `(customer)/settings/notifications` | 3 | ✓ | |
| `[tenantSlug]`（公開頁） | — | — | 客製 `<PublicPageSkeleton>` |
| `book/[slotId]` | 4 | ✓ | |
| `invite/[token]` | 2 | ✓ | |
| `login`、`signup` | — | — | 已 static prerender，不加 |

### 6.2 `<PublicPageSkeleton>` 客製元件

新增 `src/components/ui/public-page-skeleton.tsx`：模仿公開頁版型——hero 區（頭像 + 教練名 + 介紹）+ 服務卡片 grid（3 張）+ 日期 strip + 時段列表 skeleton。

### 6.3 Suspense 切塊 pattern

只在 query ≥ 2 表 join 或 limit > 50 筆，或量測 > 300ms 處用 Suspense。標準 pattern：

```tsx
export default async function Page() {
  return (
    <div>
      <Header /> {/* 立即送，無 query */}
      <Suspense fallback={<TableSkeleton rows={5} />}>
        <HeavyDataTable /> {/* async server component, 自己 await */}
      </Suspense>
    </div>
  )
}
```

預計切塊的 routes（保守清單）：
- `[tenantSlug]`：hero 立即送，slot picker stream
- `/platform/tenants`：邀請表單立即送，列表 stream
- `/platform/tenants/[tenantId]`：tenant 資料立即送，bookings / members 子表 stream
- `/calendar`：sidebar nav + 控制列立即送，grid 資料 stream（量測後決定）

其他 route 暫不切塊，loading.tsx 已足夠。

---

## 7. RWD 全面 audit

### 7.1 目標 viewports

- 375 × 667（iPhone SE）— 最小常見手機
- 768 × 1024（iPad mini）— 平板分界
- ≥ 1024px 桌面——沿用既有，**不**重大改動

### 7.2 audit checklist（每路徑）

- [ ] 無橫向 scroll
- [ ] sidebar drawer 可開合（教練後台 mobile 已有 `<MobileSidebar>`，確認無回歸）
- [ ] 表格不橫向爆炸（horizontal scroll container 或 stack-on-mobile pattern）
- [ ] 表單欄位 mobile 1 column
- [ ] 按鈕 touch target ≥ 32px
- [ ] dialog / sheet 不超出 viewport
- [ ] 行事曆 grid 在 375px **強制切換 day view**（week view 在小螢幕無法閱讀）

### 7.3 audit 紀錄

開 `docs/s2-rwd-audit.md`，欄位：路徑 / 375px 通過 / 768px 通過 / 修法 commit。每修一條獨立 commit，避免一次大改 review 不動。

---

## 8. 量測方法

### 8.1 工具

- **Chrome DevTools Performance tab**：click-to-skeleton 時間（Long Task、Paint event）
- **Network tab**：點按到 200 OK server timing
- **Vercel function logs**：cold / warm start 區分（看 `duration` 欄位）
- **Supabase Dashboard SQL editor**：query execution plan + cost

### 8.2 流程

每條重點路徑：

1. production URL 連續操作 5 次
2. 紀錄第 3、4、5 次中位數作為 warm hit
3. 同步紀錄第 1 次作為 cold hit 參考
4. 寫入 `docs/s2-perf-measurements.md`

### 8.3 量測表結構

```markdown
| 路徑 | 動作 | cold ms | warm 中位 ms | 達標? | 瓶頸 |
|---|---|---|---|---|---|
| /calendar | view 切換 | 800 | 45 | ✓ | n/a (client only) |
| /[slug] | 切日期 | 600 | 180 | ✓ | API CDN cache |
| /[slug] | 切日期 (cold) | 600 | — | — | cold start exempt |
| /platform/tenants/[id] | 開啟 | 1200 | 850 | ✗ | bookings 無 covering index — S6 |
```

### 8.4 Exception 清冊

`docs/s2-perf-measurements.md` 內附「無法達標路徑」表：路徑 / warm ms / 原因 / 處理時機（S3 / S4 / S6）。表可以不為空但**必須存在**，代表我們知道哪些超標、為什麼、何時處理。

---

## 9. 檔案異動清單

### 新增
- `src/components/ui/public-page-skeleton.tsx`
- `src/app/api/public/slots/route.ts`
- `src/app/(tenant)/calendar/calendar-panel.tsx`
- `src/app/(tenant)/calendar/day-grid.tsx`（client）
- `src/app/(tenant)/calendar/list-view-client.tsx`（如果既有 `list-view.tsx` 是 server，否則改既有）
- `src/app/[tenantSlug]/slot-picker.tsx`
- 13 個 `loading.tsx`（見 §6.1）
- `docs/s2-rwd-audit.md`
- `docs/s2-perf-measurements.md`
- `docs/superpowers/specs/2026-05-24-s2-perf-rwd-design.md`（本 spec）

### 修改
- `src/app/[tenantSlug]/page.tsx` — 抽出 slot picker，加 Suspense
- `src/app/(tenant)/calendar/page.tsx` — 改 server 拉資料一次，client 切視圖
- `src/app/(tenant)/calendar/view-tabs.tsx` — 改為純 client state controller
- `src/app/(tenant)/calendar/week-grid.tsx`、`list-view.tsx` — 視需要改 client
- `src/app/(platform)/platform/tenants/page.tsx` — 加 Suspense 包列表
- `src/app/(platform)/platform/tenants/[tenantId]/page.tsx` — 加 Suspense 包子表
- 各 route 修 RWD（依 audit 結果 case-by-case，可能涉及多個檔案）
- `README.md` — 加 perf playbook 一節
- `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md` 附錄 C — 加 FR-115~119

---

## 10. 風險與緩解

| 風險 | 機率 | 緩解 |
|---|---|---|
| 行事曆 view 切換改 client，原本 server 渲染的 `week-grid` 搬 client 推升 bundle | 中 | 量測 bundle 變化，超過 +30KB 重新評估，可考慮 `dynamic()` lazy load day / list view |
| 公開頁 `/api/public/slots` CDN cache 60s，教練剛新增時段學員 60s 內看不到 | 低 | 教練端寫入路徑（建立 slot、改 recurring rule、確認 booking、取消等）一律帶 `revalidateTag('public-slots-' + tenantId)` 主動失效 |
| RWD audit 走過所有 route 工時不可控 | 中 | audit 表逐條打勾，每條獨立 commit，過程可隨時 pause；無 P1 issue 即可關 audit，P2 / P3 留 S6 |
| Suspense 切塊改錯造成 hydration mismatch | 低 | 嚴格遵守「server component 包 Suspense + 內部 async server child」pattern，不混用 client / server boundary |
| 量測在不同地區結果差異大 | 中 | 統一在 production URL 從台灣地區量；exception 清冊註明量測點 |

---

## 11. FR 編號（回寫 parent spec 附錄 C）

- **FR-115**：全站 `loading.tsx` 普及（13 routes）+ `<PublicPageSkeleton>` 共用元件
- **FR-116**：行事曆視圖切換改 client-side state（路徑 A）
- **FR-117**：學員公開頁 service / date 切換改 client + `/api/public/slots` CDN cache + revalidateTag（路徑 B）
- **FR-118**：`/platform/tenants` 與 `/platform/tenants/[id]` Suspense 切塊（路徑 C）
- **FR-119**：375 / 768 RWD audit 全站 + audit 表 + exception 清冊

---

## 12. doc 更新清單（按 [feedback-docs-after-impl] memory）

- `README.md`：加 perf playbook 一節（如何量測、loading.tsx 慣例、Suspense pattern）
- `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md` 附錄 C：FR-115~119 條目 + commit hash 回填
- `docs/s2-rwd-audit.md`、`docs/s2-perf-measurements.md`：本 plan 產出物

---

## 13. 後續

完成本 spec → 交棒 writing-plans skill → 產出 task 分解 plan → 實作 → commit hash 回寫附錄 C。S2 完成後接 S3（行事曆與可用性管理，含林教練測試資料豐富化）。
