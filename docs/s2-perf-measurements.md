# S2 — 效能量測

**量測點**：台灣 / Chrome 最新版 / production URL
**流程**：每路徑連續 5 次，第 3、4、5 次取中位為 warm hit；第 1 次為 cold hit 參考。
**工具**：`scripts/perf-audit.mjs`（Playwright headless Chromium，抓 Server-Timing header + Navigation Timing API）。
**Baseline**：warm 中位 server-timing ≤ 500ms。
**最近一次跑**：2026-05-30（Vercel region 從 iad1 切到 hnd1 後）。

執行：
```bash
node scripts/perf-audit.mjs            # 預設打 production
E2E_BASE_URL=http://localhost:3000 node scripts/perf-audit.mjs   # 本地
```

結果 JSON 寫到 `docs/perf-audit-results.json`。

## 2026-05-30 全站量測（27 條路徑）

### 修法摘要

**根因**：Vercel function 預設在 `iad1`（美東 Washington DC），但 Supabase project 在 `ap-northeast-1`（Tokyo）。每個 Supabase query roundtrip ~280ms × 多 query → 整頁延遲累積到 1-2 秒。

**修法**：`vercel.json` 加 `"regions": ["hnd1"]`（Tokyo），colocate Vercel function 與 Supabase。

**Probe 結果**：

| Region | Supabase RTT 中位 |
|---|---|
| iad1（原） | 280ms |
| sin1 | 120ms |
| icn1 | 75ms |
| hkg1 | 95ms |
| **hnd1** ⭐ | **40ms** |

### 量測表（warm 中位 server-timing）

| 路徑 | Before (iad1) | After (hnd1) | Delta | 達標 (≤500ms)? |
|---|---|---|---|---|
| `/` | 138ms | 403ms | +265ms | ✓ |
| `/login` | 81ms | 88ms | +7ms | ✓ |
| `/signup` | 84ms | 88ms | +4ms | ✓ |
| `/[slug]` (public tenant) | 773ms | 213ms | **-560ms** | ✓ |
| `/[slug]/packages` | 988ms | 229ms | **-759ms** | ✓ |
| `/my-bookings` | 1559ms | 552ms | **-1007ms** | ✗ (52ms over) |
| `/account/notifications` | 1127ms | 407ms | **-720ms** | ✓ |
| `/[slug]/purchases` | 1445ms | 415ms | **-1030ms** | ✓ |
| `/dashboard` | 1628ms | 564ms | **-1064ms** | ✗ (64ms over) |
| `/calendar` | 2200ms | 491ms | **-1709ms** ⚡ | ✓ |
| `/calendar/availability` | 1442ms | 420ms | **-1022ms** | ✓ |
| `/calendar/rules` | 1574ms | 449ms | **-1125ms** | ✓ |
| `/services` | 1340ms | 364ms | **-976ms** | ✓ |
| `/packages` | 1551ms | 476ms | **-1075ms** | ✓ |
| `/packages/pending` | 1360ms | 366ms | **-994ms** | ✓ |
| `/customers` | 1779ms | 448ms | **-1331ms** | ✓ |
| `/bookings` | 1390ms | 458ms | **-932ms** | ✓ |
| `/staff` | 1332ms | 387ms | **-945ms** | ✓ |
| `/notifications` | 1368ms | 463ms | **-905ms** | ✓ |
| `/settings/profile` | 1335ms | 406ms | **-929ms** | ✓ |
| `/settings/notifications` | 1306ms | 364ms | **-942ms** | ✓ |
| `/platform/dashboard` | 870ms | 385ms | **-485ms** | ✓ |
| `/platform/tenants` | 1309ms | 384ms | **-925ms** | ✓ |
| `/platform/tenants/[id]` | 1582ms | 446ms | **-1136ms** | ✓ |
| `/platform/bookings` | 956ms | 361ms | **-595ms** | ✓ |
| `/platform/bookings?status=pending` | 919ms | 361ms | **-558ms** | ✓ |
| `/platform/bookings?status=confirmed` | 940ms | 366ms | **-574ms** | ✓ |

**通過率**：**25/27**（93%）。

### Exception 清冊（warm 中位數 > 500ms 的路徑）

| 路徑 | warm ms | 超 | 原因 | 處理時機 |
|---|---|---|---|---|
| `/dashboard` | 564ms | +64ms | 6 個 count query + getTenantContext + requireTenantMember，已 Promise.all 平行，每個 query exec time + 5 RTT × 40ms ≈ 564ms。要再快需要合併成單一 RPC。 | S8 / 觀察 |
| `/my-bookings` | 552ms | +52ms | 1 個 heavy join（bookings ⋈ tenants ⋈ services ⋈ slots）+ 3 count queries，Promise.all 後仍受最慢的 join query bound。 | S8 / 觀察 |

兩條都在 baseline 邊緣（+10-13%）。已 Promise.all、queries 本身合理；要再快需要 server-side aggregation RPC，工程成本對 50ms 收益不划算。**進清冊觀察**，等使用者實測抱怨再處理。

---

## 量測 flow（給跑量測的人看）

```bash
# 1. Production
node scripts/perf-audit.mjs

# 2. 看結果
cat docs/perf-audit-results.json | jq '.[] | select(.warmServerTiming > 500) | {path, warmServerTiming}'

# 3. 想看單頁細節
cat docs/perf-audit-results.json | jq '.[] | select(.path == "/calendar")'
```

對「達標」欄：
- ✓ 表示 warm 中位 server-timing ≤ 500ms
- ✗ 表示超標 → 進 Exception 清冊

每次有重大效能改動或新頁面上線都重跑一次 audit 並更新此檔。
