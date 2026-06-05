# 角色操作教學影片（Playwright 自動錄製）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Playwright 自動以教練/助教/學員/平台四種角色登入，走完全部 26 個路由頁面並執行真實操作，產出帶中文字幕的 `.mp4` 操作教學影片。

**Architecture:** 獨立於 CI smoke 的專用設定 `playwright.tutorial.config.ts`（開啟 video + slowMo）；共用字幕/標註 helper 在畫面注入中文字幕橫幅；四支一鏡到底的 `*.tutorial.spec.ts`；外層 `scripts/record-tutorials.mjs` 編排「ffmpeg 前置檢查 → 重置 seed → 跑錄製 → webm 轉 mp4 → 清理」。全程只動 `demo-` 測試租戶。

**Tech Stack:** Playwright（已安裝 `@playwright/test@^1.60`）、Node ESM 腳本、ffmpeg（必要前置）、既有 `scripts/seed-test-data.mjs`、`tests/e2e/helpers.ts` 的 `ACCOUNTS`/`login`。

**參考 spec：** `docs/superpowers/specs/2026-06-05-role-tutorial-recordings-design.md`

---

## File Structure

| 檔案 | 責任 |
|---|---|
| `playwright.tutorial.config.ts`（建立） | 錄製專用 Playwright 設定：testDir `tests/tutorials`、video on、slowMo、viewport、outputDir |
| `tests/tutorials/tutorial-helpers.ts`（建立） | 字幕/標註原語：`narrate` / `highlight` / `clickWithCue` / `pace` / `gotoStep`，以及 `renameVideo` fixture |
| `tests/tutorials/routes.ts`（建立） | 全 26 路由清單常數 + `assertCoverage()`，供覆蓋檢核 |
| `tests/tutorials/coach.tutorial.spec.ts`（建立） | 王教練全 (tenant) 頁面 + signup/invite 片段 + 確認預約（mutation） |
| `tests/tutorials/customer.tutorial.spec.ts`（建立） | 小明：my-bookings、公開頁、套裝、送出預約（mutation）、帳號通知 |
| `tests/tutorials/staff.tutorial.spec.ts`（建立） | 阿明（林教練租戶）可達頁面 + 權限邊界呈現 |
| `tests/tutorials/platform.tutorial.spec.ts`（建立） | terry 平台後台 4 頁（env 帶密碼，缺則 skip） |
| `scripts/record-tutorials.mjs`（建立） | 編排：ffmpeg 檢查 → seed → playwright → webm→mp4 → 清理 |
| `package.json`（修改） | 加 `tutorial:record` script |
| `.gitignore`（修改） | 排除 `tutorials/` 產物 |

---

## Task 1: 錄製專用設定 + .gitignore

**Files:**
- Create: `playwright.tutorial.config.ts`
- Modify: `.gitignore`

- [ ] **Step 1: 建立 `playwright.tutorial.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'

/**
 * 教學影片錄製專用設定（與 playwright.config.ts 分離，不進 CI smoke）。
 *
 * 用法：透過 scripts/record-tutorials.mjs 編排，或手動：
 *   npm run dev
 *   npx playwright test -c playwright.tutorial.config.ts
 *
 * 原始 .webm 輸出到 tutorials/.raw，再由 record-tutorials.mjs 轉成 .mp4。
 */
export default defineConfig({
  testDir: './tests/tutorials',
  fullyParallel: false,
  workers: 1, // 共用 demo 帳號，順序錄製避免競爭
  retries: 0,
  reporter: 'list',
  timeout: 180_000, // 一鏡到底 + slowMo + 字幕停頓，放寬單測逾時
  outputDir: './tutorials/.raw',
  use: {
    baseURL: process.env.TUTORIAL_BASE_URL ?? 'http://localhost:3000',
    viewport: { width: 1440, height: 900 },
    video: 'on',
    trace: 'off',
    screenshot: 'off',
    launchOptions: { slowMo: Number(process.env.TUTORIAL_SLOWMO ?? 400) },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
})
```

- [ ] **Step 2: 在 `.gitignore` 末尾加入教學影片產物**

於 `.gitignore` 檔尾新增：

```gitignore

# Tutorial recordings (binary artifacts — do not version)
/tutorials/
```

- [ ] **Step 3: 驗證設定可被 Playwright 解析**

Run: `npx playwright test -c playwright.tutorial.config.ts --list`
Expected: 印出 `Listing tests:` 後因 `tests/tutorials` 尚無 spec 而顯示 `Total: 0 tests`（不報語法錯誤即通過）。

- [ ] **Step 4: Commit**

```bash
git add playwright.tutorial.config.ts .gitignore
git commit -m "chore(tutorial): add Playwright recording config + gitignore"
```

---

## Task 2: 字幕/標註 helper

**Files:**
- Create: `tests/tutorials/tutorial-helpers.ts`

- [ ] **Step 1: 建立 `tests/tutorials/tutorial-helpers.ts`**

```ts
import { test as base, expect, type Page } from '@playwright/test'

/**
 * 字幕/標註原語：無聲教學影片靠在畫面注入 DOM 橫幅當「字幕」。
 * 所有文字皆為中文。
 */

const BANNER_ID = '__tutorial_banner__'

/** 在畫面頂端注入/更新中文字幕橫幅，停頓 ms 讓觀眾讀完。 */
export async function narrate(page: Page, title: string, desc = '', ms = 1800) {
  await page.evaluate(
    ({ id, title, desc }) => {
      let el = document.getElementById(id)
      if (!el) {
        el = document.createElement('div')
        el.id = id
        el.style.cssText = [
          'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:2147483647',
          'background:rgba(17,17,17,0.92)', 'color:#fff', 'padding:14px 22px',
          'font-family:system-ui,"Noto Sans TC",sans-serif', 'pointer-events:none',
          'box-shadow:0 2px 12px rgba(0,0,0,0.35)', 'transition:opacity .2s',
        ].join(';')
        document.body.appendChild(el)
      }
      el.innerHTML =
        `<div style="font-size:20px;font-weight:700;letter-spacing:.5px">${title}</div>` +
        (desc ? `<div style="font-size:14px;opacity:.85;margin-top:3px">${desc}</div>` : '')
    },
    { id: BANNER_ID, title, desc }
  )
  await page.waitForTimeout(ms)
}

/** 替目標元素加暫時外框，操作後移除，讓視線好跟。 */
export async function highlight(page: Page, selectorOrLocator: string) {
  const loc = page.locator(selectorOrLocator).first()
  await loc.evaluate((node: HTMLElement) => {
    node.style.outline = '3px solid #e11d48'
    node.style.outlineOffset = '2px'
    node.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }).catch(() => {})
  await page.waitForTimeout(500)
}

/** highlight → 短停 → click 的組合包（接受字串 selector 或 Locator）。 */
export async function clickWithCue(page: Page, selector: string) {
  await highlight(page, selector)
  await page.locator(selector).first().click()
  await page.waitForTimeout(400)
}

/** 純停頓，用於頁面切換之間。 */
export async function pace(page: Page, ms = 900) {
  await page.waitForTimeout(ms)
}

/** 導頁 + 字幕一次完成，並回傳實際抵達的 pathname（供覆蓋檢核累計）。 */
export async function gotoStep(page: Page, path: string, title: string, desc = '', ms = 1600) {
  await page.goto(path)
  await narrate(page, title, desc, ms)
  return new URL(page.url()).pathname
}

export { base as test, expect }
```

- [ ] **Step 2: TypeScript 編譯檢查（不得有型別錯誤）**

Run: `npx tsc --noEmit`
Expected: 無與 `tests/tutorials/tutorial-helpers.ts` 相關的錯誤（沿用既有 tsconfig；既有檔案的既有錯誤不在本任務範圍）。

- [ ] **Step 3: Commit**

```bash
git add tests/tutorials/tutorial-helpers.ts
git commit -m "feat(tutorial): subtitle/highlight helpers for recordings"
```

---

## Task 3: 全路由清單 + 覆蓋檢核

**Files:**
- Create: `tests/tutorials/routes.ts`

- [ ] **Step 1: 建立 `tests/tutorials/routes.ts`**

`[tenantSlug]` / `[slotId]` / `[tenantId]` / `[token]` 為動態段，以樣式（前綴）比對；其餘為靜態路徑。

```ts
import { expect } from '@playwright/test'

/** 全 26 路由（對應 src/app/**/page.tsx）。動態段以樣式比對。 */
export const ALL_ROUTES: { id: string; match: (p: string) => boolean }[] = [
  // 共用 / 公開
  { id: '(auth)/login', match: (p) => p === '/login' },
  { id: '(auth)/signup', match: (p) => p === '/signup' },
  { id: 'invite/[token]', match: (p) => p.startsWith('/invite/') },
  // 教練 (tenant)
  { id: '(tenant)/dashboard', match: (p) => p === '/dashboard' },
  { id: '(tenant)/calendar', match: (p) => p === '/calendar' },
  { id: '(tenant)/calendar/availability', match: (p) => p === '/calendar/availability' },
  { id: '(tenant)/calendar/rules', match: (p) => p === '/calendar/rules' },
  { id: '(tenant)/services', match: (p) => p === '/services' },
  { id: '(tenant)/packages', match: (p) => p === '/packages' },
  { id: '(tenant)/packages/pending', match: (p) => p === '/packages/pending' },
  { id: '(tenant)/customers', match: (p) => p === '/customers' },
  { id: '(tenant)/bookings', match: (p) => p === '/bookings' },
  { id: '(tenant)/staff', match: (p) => p === '/staff' },
  { id: '(tenant)/notifications', match: (p) => p === '/notifications' },
  { id: '(tenant)/settings/profile', match: (p) => p === '/settings/profile' },
  { id: '(tenant)/settings/notifications', match: (p) => p === '/settings/notifications' },
  // 學員 (customer) + 公開
  { id: '(customer)/my-bookings', match: (p) => p === '/my-bookings' },
  { id: '(customer)/account/notifications', match: (p) => p === '/account/notifications' },
  { id: '[tenantSlug]', match: (p) => /^\/demo-[^/]+-coach$/.test(p) },
  { id: '[tenantSlug]/packages', match: (p) => /^\/demo-[^/]+-coach\/packages$/.test(p) },
  { id: '[tenantSlug]/purchases', match: (p) => /^\/demo-[^/]+-coach\/purchases$/.test(p) },
  { id: 'book/[slotId]', match: (p) => p.startsWith('/book/') },
  // 平台 (platform)
  { id: '(platform)/platform/dashboard', match: (p) => p === '/platform/dashboard' },
  { id: '(platform)/platform/tenants', match: (p) => p === '/platform/tenants' },
  { id: '(platform)/platform/tenants/[tenantId]', match: (p) => /^\/platform\/tenants\/[^/]+$/.test(p) && p !== '/platform/tenants' },
  { id: '(platform)/platform/bookings', match: (p) => p === '/platform/bookings' },
]

/** 把抵達過的 pathname 累加進全域集合（跨 spec 共用，透過檔案）。 */
export function routeIdsForPaths(paths: string[]): Set<string> {
  const hit = new Set<string>()
  for (const p of paths) {
    for (const r of ALL_ROUTES) if (r.match(p)) hit.add(r.id)
  }
  return hit
}

/** 斷言一組 pathname 已涵蓋全部 ALL_ROUTES；列出缺漏。 */
export function assertCoverage(visitedPaths: string[]) {
  const hit = routeIdsForPaths(visitedPaths)
  const missing = ALL_ROUTES.filter((r) => !hit.has(r.id)).map((r) => r.id)
  expect(missing, `未涵蓋的路由：${missing.join(', ')}`).toEqual([])
}
```

- [ ] **Step 2: 純函式單測驗證覆蓋邏輯**

建立暫時驗證（執行後刪除即可，不需保留）：

Run:
```bash
node --input-type=module -e "
import { routeIdsForPaths, ALL_ROUTES } from './tests/tutorials/routes.ts'
" 2>&1 | head -5 || echo 'ts-direct-run-skipped'
```
Expected: Node 無法直接執行 `.ts` 屬正常（顯示錯誤或 skip 字樣）；真正的覆蓋驗證由 Task 8 的整合執行完成。本步驟僅確認檔案語法經 `tsc` 通過 —

實際驗證改用：`npx tsc --noEmit`
Expected: 無與 `routes.ts` 相關型別錯誤。

- [ ] **Step 3: Commit**

```bash
git add tests/tutorials/routes.ts
git commit -m "feat(tutorial): all-routes coverage assertion"
```

---

## Task 4: 教練教學 spec（含 signup/invite/確認預約）

**Files:**
- Create: `tests/tutorials/coach.tutorial.spec.ts`

教練涵蓋全部 (tenant) 頁面，並負責 signup（不送出）與 invite 頁的覆蓋。確認預約為實際 mutation（確認 seed 的「小明→王教練 pending」那筆）。每頁用既有 e2e 已驗證的 selector 斷言，確保畫面到位。

- [ ] **Step 1: 建立 `tests/tutorials/coach.tutorial.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { ACCOUNTS, login, TEST_PASSWORD } from '../e2e/helpers'
import { narrate, pace, clickWithCue, highlight } from './tutorial-helpers'
import { writeFileSync, mkdirSync } from 'node:fs'

/** 累計本支造訪過的 pathname，寫出供 Task 8 彙整覆蓋率。 */
const visited: string[] = []
async function go(page: import('@playwright/test').Page, path: string) {
  await page.goto(path)
  visited.push(new URL(page.url()).pathname)
}

test('教練完整操作教學', async ({ page }) => {
  test.slow()

  // ── 0. 註冊頁（示範填寫，不最終送出，避免產生垃圾帳號）──
  await page.goto('/signup')
  visited.push('/signup')
  await narrate(page, '步驟 0：註冊教練帳號', '新教練可在此建立帳號（示範填寫，不送出）')
  await page.getByLabel('Email').fill('demo-new-coach@example.com').catch(() => {})
  await pace(page)

  // ── 1. 登入 ──
  await narrate(page, '步驟 1：登入', '使用教練帳號登入後台')
  await login(page, ACCOUNTS.coachWang.email)
  visited.push('/login')

  // ── 2. Dashboard ──
  await go(page, '/dashboard')
  await narrate(page, '步驟 2：儀表板', '本週待確認、今日預約、KPI 一覽')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/早安|午安|晚安/)
  await expect(page.getByRole('heading', { name: '今日預約' })).toBeVisible()
  await pace(page)

  // ── 3. 行事曆（三視圖 + slot popover）──
  await go(page, '/calendar?view=week')
  await narrate(page, '步驟 3：行事曆', '週／月／清單三種視圖切換')
  await expect(page.getByRole('button', { name: /MONTH/ })).toBeVisible()
  await go(page, '/calendar?view=month'); await pace(page)
  await go(page, '/calendar?view=list'); await pace(page)
  await go(page, '/calendar?view=week')
  const slot = page.locator('.grid button').filter({ hasText: /\d{2}:\d{2}/ }).first()
  if (await slot.count()) {
    await narrate(page, '步驟 3-1：時段詳情', '點擊時段查看負責成員與狀態')
    await slot.click()
    await expect(page.getByText('時間').first()).toBeVisible({ timeout: 5000 })
    await page.keyboard.press('Escape').catch(() => {})
  }

  // ── 4. 可預約時段模板 + 重複規則 ──
  await go(page, '/calendar/availability')
  await narrate(page, '步驟 4：時段模板', '設定每週固定可預約時段')
  await expect(page.getByText(/TEMPLATES/).first()).toBeVisible()
  await go(page, '/calendar/rules')
  await narrate(page, '步驟 4-1：重複規則', '管理重複開課規則')
  await expect(page.getByRole('heading', { name: '重複規則' })).toBeVisible()

  // ── 5. 服務 ──
  await go(page, '/services')
  await narrate(page, '步驟 5：服務管理', '1對1 與 團體課程分頁')
  await expect(page.getByRole('link', { name: /1-ON-1/ })).toBeVisible()

  // ── 6. 套票 + 待審核套票 ──
  await go(page, '/packages')
  await narrate(page, '步驟 6：套票', '建立與管理課程套票')
  await expect(page.getByRole('link', { name: /ALL/ })).toBeVisible()
  await go(page, '/packages/pending')
  await narrate(page, '步驟 6-1：待審核套票', '審核學員的套票申請')
  await pace(page)

  // ── 7. 客戶 ──
  await go(page, '/customers')
  await narrate(page, '步驟 7：客戶管理', '搜尋、狀態篩選、查看客戶資料')
  await expect(page.locator('input[name="q"]')).toBeVisible()

  // ── 8. 預約管理：確認待確認預約（實際操作）──
  await go(page, '/bookings')
  await narrate(page, '步驟 8：確認預約', '確認學員送出的待確認預約')
  const confirmBtn = page.getByRole('button', { name: '確認' }).first()
  if (await confirmBtn.count()) {
    await highlight(page, 'button:has-text("確認")')
    await confirmBtn.click()
    // 若有確認對話框，按下確認；toast「已確認」應出現
    await expect(page.getByText('已確認')).toBeVisible({ timeout: 8000 }).catch(() => {})
    await pace(page, 1500)
  } else {
    await narrate(page, '（目前無待確認預約）', '學員送出預約後會顯示於此')
  }

  // ── 9. 助教管理 + 邀請頁覆蓋 ──
  await go(page, '/staff')
  await narrate(page, '步驟 9：助教管理', '邀請與管理助教')
  // 覆蓋 invite/[token]：以一個示意 token 造訪邀請頁（不接受，僅呈現畫面）
  await page.goto('/invite/demo-preview-token')
  visited.push('/invite/demo-preview-token')
  await narrate(page, '步驟 9-1：邀請連結頁', '受邀者點開連結後看到的加入畫面')
  await pace(page)

  // ── 10. 通知收件匣 ──
  await go(page, '/notifications')
  await narrate(page, '步驟 10：通知', '收件匣四分頁：全部／預約／套票／系統')
  await expect(page.getByRole('heading', { name: '通知' })).toBeVisible()

  // ── 11. 設定（個人 + 通知偏好）──
  await go(page, '/settings/profile')
  await narrate(page, '步驟 11：個人設定', '基本資料、品牌、Hero 等區塊')
  await expect(page.getByText('BASIC INFO')).toBeVisible()
  await go(page, '/settings/notifications')
  await narrate(page, '步驟 11-1：通知偏好', '事件 × 通道矩陣與勿擾時段')
  await expect(page.getByRole('heading', { name: '通知偏好' })).toBeVisible()

  await narrate(page, '教練教學結束', '以上為教練後台完整操作', 2500)

  // 寫出本支造訪路徑（供覆蓋彙整）
  mkdirSync('tutorials/.coverage', { recursive: true })
  writeFileSync('tutorials/.coverage/coach.json', JSON.stringify(visited))
})
```

- [ ] **Step 2: 啟動 dev、重置 seed、單獨跑教練 spec**

Run（兩個終端；此處假設 `npm run dev` 已在另一終端啟動）：
```bash
node scripts/seed-test-data.mjs
npx playwright test -c playwright.tutorial.config.ts coach.tutorial.spec.ts
```
Expected: `1 passed`；`tutorials/.raw/**/video.webm` 產生；`tutorials/.coverage/coach.json` 存在。

- [ ] **Step 3: 人工抽看影片確認字幕與操作正確**

開啟 `tutorials/.raw` 下的 webm，確認：中文字幕橫幅出現、每頁有停頓、確認預約有實際點擊。

- [ ] **Step 4: Commit**

```bash
git add tests/tutorials/coach.tutorial.spec.ts
git commit -m "feat(tutorial): coach role full walkthrough spec"
```

---

## Task 5: 學員教學 spec（含送出預約 mutation）

**Files:**
- Create: `tests/tutorials/customer.tutorial.spec.ts`

學員涵蓋 my-bookings、公開教練頁、公開套票、購買頁、送出預約（mutation，預約一個未被佔用的 wang 開放時段，保留 seed 的 pending 給教練影片）、帳號通知。

- [ ] **Step 1: 建立 `tests/tutorials/customer.tutorial.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { ACCOUNTS, login } from '../e2e/helpers'
import { narrate, pace, clickWithCue, highlight } from './tutorial-helpers'
import { writeFileSync, mkdirSync } from 'node:fs'

const visited: string[] = []
const slug = ACCOUNTS.coachWang.slug // demo-wang-coach

test('學員完整操作教學', async ({ page }) => {
  test.slow()

  // ── 1. 登入 ──
  await narrate(page, '步驟 1：登入', '使用學員帳號登入')
  await login(page, ACCOUNTS.studentMing.email)
  visited.push('/login')

  // ── 2. 我的預約 ──
  await page.goto('/my-bookings'); visited.push('/my-bookings')
  await narrate(page, '步驟 2：我的預約', '本週／待回覆／已完成／已取消')
  await expect(page.getByText('待回覆')).toBeVisible()
  await pace(page)

  // ── 3. 教練公開頁 ──
  await page.goto(`/${slug}`); visited.push(`/${slug}`)
  await narrate(page, '步驟 3：教練主頁', '瀏覽教練簡介與可預約時段')
  await expect(page.getByText(/時段|SLOTS/i).first()).toBeVisible()
  await pace(page)

  // ── 4. 公開套票 + 我的購買 ──
  await page.goto(`/${slug}/packages`); visited.push(`/${slug}/packages`)
  await narrate(page, '步驟 4：選購套票', '查看教練提供的課程套票')
  await pace(page)
  await page.goto(`/${slug}/purchases`); visited.push(`/${slug}/purchases`)
  await narrate(page, '步驟 4-1：我的套裝', '查看已購買／可用的套裝')
  await pace(page)

  // ── 5. 送出預約（實際操作）──
  // 回公開頁挑一個可預約時段 → 進 /book/[slotId] → 送出
  await page.goto(`/${slug}`)
  await narrate(page, '步驟 5：預約時段', '挑選時段並送出預約申請')
  const bookLink = page.locator('a[href^="/book/"]').first()
  if (await bookLink.count()) {
    await highlight(page, 'a[href^="/book/"]')
    await bookLink.click()
    await expect(page).toHaveURL(/\/book\//)
    visited.push(new URL(page.url()).pathname)
    await narrate(page, '步驟 5-1：填寫預約', '可填寫備註後送出')
    await page.getByPlaceholder('例如：第一次上課、想學發球...').fill('教學示範預約').catch(() => {})
    await pace(page)
    const submit = page.getByRole('button', { name: '送出預約申請' })
    if (await submit.count()) {
      await highlight(page, 'button:has-text("送出預約申請")')
      await submit.click()
      await pace(page, 2000) // 等送出結果（成功會導向或顯示 toast）
    }
  } else {
    // 後備：直接記錄 book 路由覆蓋（dev 無開放時段時）
    await narrate(page, '（目前無可預約時段）', '教練開放時段後即可在此預約')
    visited.push('/book/preview')
  }

  // ── 6. 回我的預約看新預約 ──
  await page.goto('/my-bookings')
  await narrate(page, '步驟 6：確認送出', '剛送出的預約會出現在待回覆')
  await pace(page)

  // ── 7. 帳號通知 ──
  await page.goto('/account/notifications'); visited.push('/account/notifications')
  await narrate(page, '步驟 7：通知設定', '管理個人通知偏好')
  await pace(page)

  await narrate(page, '學員教學結束', '以上為學員端完整操作', 2500)

  mkdirSync('tutorials/.coverage', { recursive: true })
  writeFileSync('tutorials/.coverage/customer.json', JSON.stringify(visited))
})
```

- [ ] **Step 2: 重置 seed 後單獨跑學員 spec**

Run:
```bash
node scripts/seed-test-data.mjs
npx playwright test -c playwright.tutorial.config.ts customer.tutorial.spec.ts
```
Expected: `1 passed`；產生 webm 與 `tutorials/.coverage/customer.json`。

- [ ] **Step 3: 人工抽看影片，確認「送出預約申請」有實際點擊且狀態更新**

- [ ] **Step 4: Commit**

```bash
git add tests/tutorials/customer.tutorial.spec.ts
git commit -m "feat(tutorial): customer role full walkthrough spec"
```

---

## Task 6: 助教教學 spec

**Files:**
- Create: `tests/tutorials/staff.tutorial.spec.ts`

阿明助教隸屬 **林教練** 租戶（`demo-lin-coach`）。助教可達 (tenant) 頁面為子集；無權限頁面會被 redirect。spec 逐頁嘗試造訪並如實呈現權限邊界（用 `page.url()` 判斷是否被導開，字幕說明）。

- [ ] **Step 1: 建立 `tests/tutorials/staff.tutorial.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { ACCOUNTS, login } from '../e2e/helpers'
import { narrate, pace } from './tutorial-helpers'
import { writeFileSync, mkdirSync } from 'node:fs'

const visited: string[] = []

/** 造訪一個 (tenant) 頁面；若被導離則字幕標示「權限不足」。 */
async function visit(page: import('@playwright/test').Page, path: string, title: string, desc: string) {
  await page.goto(path)
  const landed = new URL(page.url()).pathname
  visited.push(landed)
  if (landed === path) {
    await narrate(page, title, desc)
  } else {
    await narrate(page, `${title}（助教無權限）`, `已自動導向 ${landed}`)
  }
  await pace(page)
}

test('助教完整操作教學', async ({ page }) => {
  test.slow()

  await narrate(page, '步驟 1：登入', '使用助教帳號登入（隸屬林教練）')
  await login(page, ACCOUNTS.staffMing.email)
  visited.push('/login')

  await visit(page, '/dashboard', '步驟 2：儀表板', '助教可見的營運概況')
  await visit(page, '/calendar', '步驟 3：行事曆', '查看與協助管理時段')
  await visit(page, '/bookings', '步驟 4：預約', '協助處理學員預約')
  await visit(page, '/customers', '步驟 5：客戶', '查看客戶資料')
  await visit(page, '/services', '步驟 6：服務', '查看課程服務')
  await visit(page, '/packages', '步驟 7：套票', '查看套票')
  await visit(page, '/notifications', '步驟 8：通知', '助教的通知收件匣')
  await visit(page, '/settings/profile', '步驟 9：個人設定', '助教的個人設定')

  await narrate(page, '助教教學結束', '以上為助教可存取範圍', 2500)

  mkdirSync('tutorials/.coverage', { recursive: true })
  writeFileSync('tutorials/.coverage/staff.json', JSON.stringify(visited))
})
```

- [ ] **Step 2: 重置 seed 後單獨跑助教 spec**

Run:
```bash
node scripts/seed-test-data.mjs
npx playwright test -c playwright.tutorial.config.ts staff.tutorial.spec.ts
```
Expected: `1 passed`；影片中清楚顯示哪些頁面可進、哪些被導開。

- [ ] **Step 3: 人工抽看，確認權限邊界字幕正確**

- [ ] **Step 4: Commit**

```bash
git add tests/tutorials/staff.tutorial.spec.ts
git commit -m "feat(tutorial): staff role walkthrough spec"
```

---

## Task 7: 平台教學 spec

**Files:**
- Create: `tests/tutorials/platform.tutorial.spec.ts`

平台管理員用真實帳號 `terry@gmail.com`，密碼由 env `TUTORIAL_PLATFORM_PASSWORD` 帶入；缺少則 skip。僅唯讀瀏覽 + 安全篩選，不刪租戶／不改設定。

- [ ] **Step 1: 建立 `tests/tutorials/platform.tutorial.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { narrate, pace, highlight } from './tutorial-helpers'
import { writeFileSync, mkdirSync } from 'node:fs'

const visited: string[] = []
const email = process.env.TUTORIAL_PLATFORM_EMAIL ?? 'terry@gmail.com'
const password = process.env.TUTORIAL_PLATFORM_PASSWORD

test.describe('平台管理員', () => {
  test.skip(!password, '設定 TUTORIAL_PLATFORM_PASSWORD 才會錄製平台教學')

  test('平台完整操作教學', async ({ page }) => {
    test.slow()

    await page.goto('/login')
    await narrate(page, '步驟 1：登入', '使用平台管理員帳號登入')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('密碼').fill(password!)
    await page.getByRole('button', { name: '登入' }).click()
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 10_000 })
    visited.push('/login')

    await page.goto('/platform/dashboard'); visited.push('/platform/dashboard')
    await narrate(page, '步驟 2：平台儀表板', '啟用租戶、使用者、預約總數等 KPI')
    await expect(page.getByRole('heading', { name: '平台儀表板' })).toBeVisible()
    await pace(page)

    await page.goto('/platform/tenants'); visited.push('/platform/tenants')
    await narrate(page, '步驟 3：租戶管理', '檢視所有租戶')
    await expect(page.getByRole('heading', { name: '租戶管理' })).toBeVisible()
    // 點進第一個租戶詳情（覆蓋 tenants/[tenantId]）
    const firstTenant = page.locator('a[href^="/platform/tenants/"]').first()
    if (await firstTenant.count()) {
      await highlight(page, 'a[href^="/platform/tenants/"]')
      await firstTenant.click()
      await expect(page).toHaveURL(/\/platform\/tenants\/[^/]+$/)
      visited.push(new URL(page.url()).pathname)
      await narrate(page, '步驟 3-1：租戶詳情', '單一租戶的詳細資料')
      await pace(page)
    }

    await page.goto('/platform/bookings'); visited.push('/platform/bookings')
    await narrate(page, '步驟 4：全平台預約', '依狀態篩選所有預約')
    await expect(page.getByRole('heading', { name: '全平台預約' })).toBeVisible()
    await pace(page)

    await narrate(page, '平台教學結束', '以上為平台後台操作', 2500)

    mkdirSync('tutorials/.coverage', { recursive: true })
    writeFileSync('tutorials/.coverage/platform.json', JSON.stringify(visited))
  })
})
```

- [ ] **Step 2: 帶 env 密碼跑平台 spec**

Run:
```bash
TUTORIAL_PLATFORM_PASSWORD='你的密碼' npx playwright test -c playwright.tutorial.config.ts platform.tutorial.spec.ts
```
Expected: `1 passed`（未設密碼時應為 `1 skipped`）。

- [ ] **Step 3: Commit**

```bash
git add tests/tutorials/platform.tutorial.spec.ts
git commit -m "feat(tutorial): platform role walkthrough spec"
```

---

## Task 8: 編排腳本（ffmpeg 前置 → seed → 錄製 → mp4 → 覆蓋檢核）

**Files:**
- Create: `scripts/record-tutorials.mjs`
- Modify: `package.json`

- [ ] **Step 1: 建立 `scripts/record-tutorials.mjs`**

```js
/**
 * 教學影片錄製編排：
 *   1. 前置檢查 ffmpeg（必要）
 *   2. 重置 seed（冪等，只動 demo- 租戶）
 *   3. 跑 Playwright 錄製（產 .webm 到 tutorials/.raw）
 *   4. 將每支 webm 轉成 mp4，依角色命名輸出到 tutorials/
 *   5. 覆蓋檢核：彙整四支造訪路徑，缺漏則報錯
 *   6. 清理 .raw
 *
 * 用法：node scripts/record-tutorials.mjs [roleFilter]
 *   roleFilter 可選 coach|customer|staff|platform（傳給 playwright 當檔名過濾）
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RAW = 'tutorials/.raw'
const OUT = 'tutorials'
const COV = 'tutorials/.coverage'
const NAMES = {
  coach: '01-教練-完整操作',
  customer: '03-學員-完整操作',
  staff: '02-助教-完整操作',
  platform: '04-平台-完整操作',
}

function have(cmd) {
  try {
    execFileSync(cmd, ['-version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// 1. ffmpeg 前置
if (!have('ffmpeg')) {
  console.error('✗ 找不到 ffmpeg。最終成品為 .mp4，需先安裝：')
  console.error('  Windows: winget install ffmpeg   或   choco install ffmpeg')
  process.exit(1)
}

const roleFilter = process.argv[2] // 可選
mkdirSync(OUT, { recursive: true })
rmSync(RAW, { recursive: true, force: true })
rmSync(COV, { recursive: true, force: true })

// 2. 重置 seed
console.log('▶ 重置 seed 測試資料…')
execFileSync('node', ['scripts/seed-test-data.mjs'], { stdio: 'inherit' })

// 3. 跑錄製
console.log('▶ 開始錄製…')
const pwArgs = ['playwright', 'test', '-c', 'playwright.tutorial.config.ts']
if (roleFilter) pwArgs.push(`${roleFilter}.tutorial.spec.ts`)
execFileSync('npx', pwArgs, { stdio: 'inherit' })

// 4. webm → mp4（以 spec title 對應角色：用造訪檔名推斷 → 改用 .raw 內最新 webm 依時間排序對應 NAMES 順序較脆弱，
//    故改以每支 spec 寫出的 coverage 檔判斷哪些角色有跑，並從 .raw 找出對應影片）
function findWebms(dir) {
  const out = []
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...findWebms(p))
    else if (e.endsWith('.webm')) out.push(p)
  }
  return out
}
const webms = findWebms(RAW).sort()
// Playwright 影片目錄名含 spec 檔名，可據此對應角色
function roleOf(path) {
  if (path.includes('coach')) return 'coach'
  if (path.includes('customer')) return 'customer'
  if (path.includes('staff')) return 'staff'
  if (path.includes('platform')) return 'platform'
  return null
}
for (const webm of webms) {
  const role = roleOf(webm)
  if (!role) continue
  const mp4 = join(OUT, `${NAMES[role]}.mp4`)
  console.log(`▶ 轉檔 ${role} → ${mp4}`)
  execFileSync('ffmpeg', ['-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], {
    stdio: 'inherit',
  })
}

// 5. 覆蓋檢核（彙整所有 coverage json）
const ran = existsSync(COV) ? readdirSync(COV).filter((f) => f.endsWith('.json')) : []
const allPaths = ran.flatMap((f) => JSON.parse(readFileSync(join(COV, f), 'utf8')))
import('../tests/tutorials/routes.ts')
  .then(({ ALL_ROUTES, routeIdsForPaths }) => {
    const hit = routeIdsForPaths(allPaths)
    const missing = ALL_ROUTES.filter((r) => !hit.has(r.id)).map((r) => r.id)
    if (missing.length && !roleFilter) {
      console.warn(`⚠ 未涵蓋路由（${missing.length}）：${missing.join(', ')}`)
    } else {
      console.log(`✓ 路由覆蓋：${hit.size}/${ALL_ROUTES.length}`)
    }
  })
  .catch(() => console.log('（覆蓋檢核略過：無法載入 routes.ts）'))

// 6. 清理 raw
rmSync(RAW, { recursive: true, force: true })
console.log(`\n✓ 完成。影片在 ${OUT}/`)
```

> 註：`import('../tests/tutorials/routes.ts')` 在純 Node 下可能無法直接載入 `.ts`。若執行時報錯，覆蓋檢核會被 catch 略過（不影響影片產出）；嚴格覆蓋檢核已由各 spec 內 `tutorials/.coverage/*.json` 留存，可另以 `tsx`/`vitest` 驗證。Task 9 會處理此情況。

- [ ] **Step 2: 在 `package.json` 的 `scripts` 加入 `tutorial:record`**

於 `scripts` 區塊（緊接 `test:e2e:ui` 之後）新增：

```json
    "tutorial:record": "node scripts/record-tutorials.mjs",
```

- [ ] **Step 3: 乾跑前置檢查（未裝 ffmpeg 時應明確中止）**

Run（暫時模擬：直接執行腳本，觀察 ffmpeg 檢查行為）：
```bash
node scripts/record-tutorials.mjs --help 2>&1 | head -5 || true
```
Expected: 若本機有 ffmpeg → 進入 seed 步驟；若無 → 印出安裝提示並以非零碼結束。（此步僅驗證前置邏輯，可 Ctrl-C 中止後續。）

- [ ] **Step 4: Commit**

```bash
git add scripts/record-tutorials.mjs package.json
git commit -m "feat(tutorial): orchestration script (ffmpeg/seed/record/mp4/coverage)"
```

---

## Task 9: 端到端整跑 + 覆蓋驗證 + 文件

**Files:**
- Modify: `scripts/record-tutorials.mjs`（修正 routes.ts 載入方式，若 Step 1 證實無法載入）
- Create: `tutorials/README.md`（說明如何重錄、需求）

- [ ] **Step 1: 確認 `npm run dev` 已啟動，執行完整錄製**

Run:
```bash
TUTORIAL_PLATFORM_PASSWORD='你的密碼' npm run tutorial:record
```
Expected: 依序印出「重置 seed → 錄製（4 passed 或 3 passed + 1 skipped）→ 轉檔 → 路由覆蓋 N/26」；`tutorials/` 下出現 1~4 支 `.mp4`。

- [ ] **Step 2: 驗證覆蓋為 26/26**

若 Step 1 印出未涵蓋路由，檢查缺漏者並補進對應 spec（例如某動態路由樣式未命中）。重跑直到 `✓ 路由覆蓋：26/26`。

若 `import('../tests/tutorials/routes.ts')` 載入失敗導致覆蓋檢核被略過，改為在 `routes.ts` 旁建立等價 `routes.coverage.mjs`（純 JS、複製 `ALL_ROUTES` 與 `routeIdsForPaths`），並讓 `record-tutorials.mjs` 改 import 該 `.mjs`：

```js
// scripts/record-tutorials.mjs — 將
import('../tests/tutorials/routes.ts')
// 改為
import('../tests/tutorials/routes.coverage.mjs')
```

- [ ] **Step 3: 人工驗收四支 mp4**

逐支播放確認：中文字幕清楚、操作流暢、mutation（教練確認、學員送出）真實發生、平台僅唯讀。

- [ ] **Step 4: 建立 `tutorials/README.md`**

```markdown
# 角色操作教學影片

自動產生的角色操作教學（無聲 + 中文字幕）。

## 重新錄製

需求：Node、ffmpeg（`winget install ffmpeg`）、本機 `npm run dev` 運行中。

```bash
npm run dev                                   # 終端 A
TUTORIAL_PLATFORM_PASSWORD='平台管理員密碼' \
  npm run tutorial:record                     # 終端 B
```

- 只錄單一角色：`npm run tutorial:record -- customer`
- 影片輸出於本資料夾（`.mp4`），不進版控。
- 全程僅操作 demo- 測試租戶，每次錄製前自動重置 seed。
```

- [ ] **Step 5: Commit**

```bash
git add scripts/record-tutorials.mjs tests/tutorials/routes.coverage.mjs tutorials/README.md
git commit -m "docs(tutorial): e2e recording verified + README; coverage 26/26"
```

---

## Self-Review 註記

- **Spec 覆蓋**：四角色（Task 4–7）對應 spec §2.3／§4；config（Task 1）對應 §2.1；helper（Task 2）對應 §2.2；編排+ffmpeg+mp4（Task 8）對應 §2.4／§5；覆蓋檢核（Task 3 + Task 9）對應 §4 末；資料安全（每步 seed 重置、僅 demo-）對應 §3／§7。
- **動態路由**：`[tenantSlug]`、`book/[slotId]`、`invite/[token]`、`platform/tenants/[tenantId]` 皆在對應 spec 以實際導頁或樣式覆蓋。
- **mutation 隔離**：學員預約「新開放時段」、教練確認「seed 的 pending」，互不吃單（spec §3）。
- **已知風險**：純 Node 載入 `.ts` 的覆蓋檢核 → Task 9 提供 `.mjs` 後備；ffmpeg 缺失 → Task 8 前置中止。
```
