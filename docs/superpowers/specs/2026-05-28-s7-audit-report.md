---
title: S7 Architecture / Security Audit Report
date: 2026-05-28
status: read-only audit (no fixes shipped — feeds future spec/plan for high-priority fixes)
scope: post-Phase-1 claudeDesign UI alignment; runs after `docs/superpowers/specs/2026-05-28-supabase-advisors-snapshot.md`
companion: 2026-05-28-supabase-advisors-snapshot.md(已涵蓋 80% RLS / perf)
---

# S7 Audit Report

Original S7 scope per memory `project-s7-next.md`:耦合度 / 檔案大小 / test coverage / RLS audit / open-redirect / 權限矩陣 / Storage 規則 / hard-coded secrets。

Supabase advisor 已涵蓋 RLS + storage + index 那一段(separate doc)。本份補完剩下:**open-redirect / 權限矩陣 / 檔案大小 / hard-coded secrets / test coverage gaps**。

---

## 🔴 P0 Critical — Open-redirect in OAuth callback

**File:** `src/app/(auth)/callback/route.ts:7,14`

```ts
const next = searchParams.get('next') ?? '/'
// ...
return NextResponse.redirect(`${origin}${next}`)
```

`next` 直接從 query string 拿來組 URL,**沒過 `safePath`**。瀏覽器對下列 input 會做 host fallback:
- `?next=//evil.com` → `https://yoursite.com//evil.com` → 瀏覽器當 protocol-relative,跳 `evil.com`
- `?next=/\evil.com` → `https://yoursite.com/\evil.com` → 大多瀏覽器 normalize 成 `//evil.com`,同上

這是 OAuth callback,使用情境是「Supabase Auth signed in → 回到原本 next URL」。攻擊者只要做 phishing,讓 user 點 `https://yoursite.com/callback?code=…&next=//evil.com`,登入後就被導到 evil.com,並可能洩漏 referer / session 給惡意站。

**S5 的 `safePath`**(`(auth)/login/actions.ts:15` + `(auth)/signup/actions.ts:17`)已防同類 — 但 callback route 漏了同樣的保護。

**Fix path:**
1. 抽出 `safePath` 到 `src/lib/safe-path.ts`(DRY,目前重複兩份)
2. 在 callback route 套用:`return NextResponse.redirect(\`${origin}${safePath(next)}\`)`
3. 加 unit test for `safePath`(目前 4 個 edge case 都該驗:`/`、`/foo/bar`、`//evil`、`/\evil`)

**Risk if unfixed:** 中等。OAuth 流程是入口面,phishing 場景現實存在。應該優先修。

---

## 🟡 P1 Important — `safePath` duplicated in 2 files

**Files:** `src/app/(auth)/login/actions.ts:15-22` + `src/app/(auth)/signup/actions.ts:17-24`

兩份字字相同 implementation。任一改動容易漏改另一份。DRY violation。

**Fix:** 移到 `src/lib/safe-path.ts`,兩個 actions + callback route 都 import 同一份。

---

## 🟢 Permission matrix — clean

驗證 18 個 page routes + 9 個 route handlers 的 auth 層:

| Surface | Guard | Verdict |
|---|---|---|
| `(auth)/{login,signup,callback}` | None (public) | ✅ Correct |
| `[tenantSlug]/*` 公開頁 | None (public) | ✅ Correct |
| `book/[slotId]` | Inline `getSession` + redirect | ✅ Correct |
| `invite/[token]` | Token table lookup, inline logic | ✅ Correct |
| `(customer)/layout.tsx` | `requireSession()` only | 🟡 Loose — 不 role-gate;tenant/admin 進來也能看(他們 customers 表沒 row,看到空 my-bookings,不洩漏);可接受 |
| `(platform)/layout.tsx` | role early-redirect + `requirePlatformAdmin()` | ✅ Tight — 2026-05-28 commit `1498734` 補上 cross-role redirect |
| `(tenant)/layout.tsx` | role early-redirect + `requireTenantMember()` | ✅ Tight (同上 commit) |
| `(tenant)/staff/page.tsx` | Owner-only inline check | ✅ Defence in depth |
| `(tenant)/settings/profile/page.tsx:19` | Owner-only inline check | ✅ Defence in depth |
| `/api/cron/*` × 5 | `Bearer ${CRON_SECRET}` header | ✅ Correct |
| `/api/push/subscribe` | `supabase.auth.getUser()` | ✅ Correct |
| `/api/public/slots` | Anon (public read of available slots) | ✅ Correct |
| `/api/logout` | None (just clears cookie) | ✅ Correct |

中間件 `src/middleware.ts` protected 名單目前是:`/platform /dashboard /calendar /bookings /services /staff /customers /packages /my-bookings /settings /notifications /account /invite`。每條都對應一個有 layout/page 級 guard 的 route。No gap detected.

**沒有缺漏**(2026-05-28 補了 `/packages` 跟 `/account`,跟 layout cross-role redirect)。

---

## 🟢 Hard-coded secrets / env leakage — clean

`SUPABASE_SERVICE_ROLE_KEY` 只出現在 `src/lib/supabase/server.ts`(`createSupabaseAdminClient`)。
`CRON_SECRET` 只出現在 5 個 cron route handlers。
`VAPID_PRIVATE_KEY` 只出現在 `src/lib/push.ts`(server-side push send)。

Client-side code(`*.tsx` with `'use client'` + non-server files)只用 `NEXT_PUBLIC_*` env vars:`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`NEXT_PUBLIC_VAPID_PUBLIC_KEY`、`NEXT_PUBLIC_APP_URL`。

**沒有 secret 洩漏到 client bundle 的風險。**

---

## 🟢 File size / complexity — healthy

Top 10 largest files in `src/`(excluding generated `supabase/types.ts` 1214 lines):

| Lines | File |
|---|---|
| 423 | `(tenant)/settings/profile/profile-form.tsx` |
| 419 | `[tenantSlug]/page.tsx` |
| 419 | `(tenant)/packages/page.tsx` |
| 404 | `(tenant)/dashboard/page.tsx` |
| 393 | `(tenant)/calendar/recurring-rule-dialog.tsx` |
| 358 | `(tenant)/customers/page.tsx` |
| 355 | `(platform)/platform/tenants/[tenantId]/page.tsx` |
| 301 | `(customer)/my-bookings/page.tsx` |
| 298 | `(tenant)/calendar/page.tsx` |
| 267 | `(tenant)/calendar/availability/template-editor.tsx` |

**No file > 500 lines.** Page-level 300-420 lines 在 Next.js App Router 是健康範圍(server query + JSX 都集中在 page.tsx 是 framework convention)。No immediate refactor needed。

`profile-form.tsx`(423)接近邊界,如果 Phase 2 加 drag-to-reorder 等 feature 會超過。屆時可考慮拆 `BasicInfoSection / HeroMetaSection / ContactSection / AboutSection / VideoSection / GallerySection` 成獨立 client 元件。

---

## 🟡 Test coverage — gaps列表

**現況:** 22 個 test files / 105 unit & integration + 31 Playwright E2E。

**有覆蓋的:**

| Surface | Test type | File |
|---|---|---|
| RPC `book_slot_atomic` | Integration | `tests/integration/atomic-booking.test.ts` |
| RPC overlap / GIST EXCLUDE | Integration | `tests/integration/exclude-constraint.test.ts` |
| RPC `reschedule_booking` / `cancel_booking` | Implicit via atomic-booking + e2e-verify | (混在 e2e-verify.mjs Step 11) |
| Recurring rules materialize | Integration + unit | `tests/integration/recurring-rules.test.ts` + `tests/unit/recurrence.test.ts` |
| RLS multi-role | Integration | `tests/integration/rls-identity.test.ts` |
| Staff vs Owner isolation | Integration | `tests/integration/staff-isolation.test.ts` |
| Availability template effective | Unit | `tests/unit/availability.test.ts` |
| Cache tags | Unit | `tests/unit/cache-tags.test.ts` |
| Errors / AppError | Unit | `tests/unit/errors.test.ts` |
| Purchases helpers | Unit | `tests/unit/purchases.test.ts` |
| next-safe-action wrapper | Unit | `tests/unit/safe-action.test.ts` |
| Sanitize-html | Unit | `tests/unit/sanitize.test.ts` |
| Slug validation | Unit | `tests/unit/slug.test.ts` |
| Video embed | Unit | `tests/unit/video-embed.test.ts` |
| All 12 P1 primitives | Component unit | `tests/unit/components/*` |
| 17 pages + 7 flows | E2E browser | `tests/e2e/*` + `e2e-verify.mjs` |

**Gaps to consider filling**(優先序):

1. **RPC `book_with_purchase` / `cancel_booking_refund` / `reschedule_booking_purchase`** — S4 era 的新 RPC,只有透過 e2e-verify.mjs 間接測。建議補 dedicated integration test 驗 `purchase.classes_used` 增減正確 + 過期 purchase 不能用。
2. **Cron routes** — `materialize-recurring` / `daily-reminder` / `pre-event-reminder` / `weekly-summary` / `auto-cancel-group-class` 全部沒 unit test。可以 mock supabase client + assert SQL 呼叫流程,或 integration 用 service role 直接觸發。
3. **Notification preferences save action** — `(tenant)/settings/notifications/actions.ts` 的 upsert 沒 test。建議補 integration 驗 jsonb channels merge + RLS。
4. **Purchase approve / reject server actions** — `(tenant)/packages/pending/purchase-actions.ts` 沒 unit test;integration 部分由 e2e-verify.mjs 覆蓋。
5. **`safePath`** — 抽出 lib 後該補 unit test(見 P0 fix)。
6. **`safePath` open-redirect bypass attempts** — 邊界 case:`/foo/bar?next=//evil.com`、`%2F%2Fevil.com`(URL-encoded slash)等。

**Not gaps**(已涵蓋):公開頁 + auth + customer flow 由 Playwright e2e + e2e-verify.mjs 雙重覆蓋,信心度高。

---

## 🟢 Storage — covered by advisor + 2026-05-28 fix

`coach-media` bucket SELECT listing 已收緊(commit `b613dcd`)。Insert/Update/Delete policies 都 tenant-scoped via `current_user_owner_tenant_ids()`(`storage_coach_media_bucket.sql`)。File size + MIME type 限制 OK。

無 followup。

---

## 🟢 Coupling — healthy

快速掃 `src/lib/` import 圖:
- `auth/get-session.ts` → `auth/get-tenant-context.ts` → `supabase/server.ts`(線性)
- `notify-booking.ts` → `push.ts` + `supabase/server.ts` + `notifications/*`(線性)
- `safe-action.ts` → `errors.ts`(線性)
- 沒有循環依賴

頁面之間沒有 cross-page direct import(都走 `@/lib/*` + `@/components/*`)。

無 followup。

---

## 📋 Action items 建議優先序

| # | Item | Priority | Effort | Risk |
|---|---|---|---|---|
| 1 | **Fix open-redirect in (auth)/callback** + 抽 `safePath` 到 `src/lib/` + unit test | 🔴 P0 | 30 min | Low |
| 2 | Dashboard 1-click: 開「Prevent sign up with leaked passwords」 | 🔴 P0 | 1 click | Zero |
| 3 | RLS rewrite — 120 multiple_permissive_policies + 10 auth_rls_initplan(從 advisor snapshot) | 🟠 P1 | 2-3 hrs | Med-High;需要 brainstorm/spec/plan + integration test 護身 |
| 4 | Audit 14 個 `SECURITY DEFINER` RPC 逐個 caller-guard review | 🟠 P1 | 1-2 hrs | Low(read-only,只是檢查) |
| 5 | Test coverage gaps #1-#4(book_with_purchase / cron / notif prefs / purchase actions integration) | 🟡 P2 | 4-6 hrs spread | Low |
| 6 | Drop 10 unused indexes(advisor lint;一週後再 confirm) | 🟡 P2 | 1 migration | Low |
| 7 | Move `btree_gist` extension out of public schema | 🟢 P3 | 1 migration | Low — cosmetic |

**Recommended next batch:** **#1 + #2 + #4 together** as a small "post-Phase-1 security polish" — addressable in ~2 hours,covers the biggest open exposure(open-redirect + leaked-password + SECURITY DEFINER review)。

**RLS rewrite (#3)** 屬完整工作,該按 brainstorm→spec→plan→subagent flow,**不該 inline**。

---

## 📂 Companion docs

- `2026-05-28-supabase-advisors-snapshot.md` — RLS / perf advisor 完整列表(advisor 抓的 80%)
- `2026-05-27-claudedesign-ui-alignment-design.md` — Phase 1 spec(已 ship)
- `docs/ux-audit.md` — 整體 UX 角度的歷史 audit
- `docs/e2e-manual-checklist.md` — 4 role manual walkthrough(catch visual regressions advisor 看不到的)
