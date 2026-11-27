import { test, expect, type Locator, type Page } from '@playwright/test'
import { login, logout } from './helpers'
import {
  SVC,
  cleanupBfv2E2e,
  createServicePackage,
  insertInAppNotification,
  setupBfv2E2e,
  tenantSlugOf,
  type Bfv2E2e,
} from './bfv2-fixture'

/**
 * 站內通知 A：學員頁首鈴鐺與小視窗、學員通知頁、教練端側欄與手機選單的未讀提示。
 *
 * 前置條件：
 *   - 需要 migration 20261126120000_in_app_notifications.sql 與
 *     20261127120000_notification_log_update_read_at_only.sql 都已執行。
 *   - 需要席位。
 *   - 會寫入資料庫：不可與整合測試（npm run test:integration）同時跑。
 *
 * 測試資料全部由 bfv2-fixture.ts 在 beforeAll 建立（獨立的 bfv2e2e- 租戶與帳號），afterAll 清掉；
 * 不使用、也不修改 demo 帳號的資料。
 *
 * 關於「學員沒有允許推播」：fixture 建立的學員從未在瀏覽器允許推播（沒有任何推播訂閱），
 * 所以情境 1 本身就是「沒有允許推播」的情況——站內通知照樣要出現。因此把「教練取消 → 學員看到通知」
 * 與「沒有允許推播時一樣成立」合併成同一個測試，並在測試開頭確認瀏覽器沒有推播權限。
 */

const DESKTOP = { width: 1280, height: 800 }
const MOBILE = { width: 390, height: 844 }
/** 通知是在請求結束後才寫入，等它出現的上限 */
const NOTIFY_TIMEOUT = 20_000

let ctx: Bfv2E2e

test.beforeAll(async () => {
  test.setTimeout(180_000)
  ctx = await setupBfv2E2e()
})

test.afterAll(async () => {
  test.setTimeout(120_000)
  await cleanupBfv2E2e()
})

/** 學員頁首的鈴鐺按鈕 */
function customerBell(page: Page): Locator {
  return page.locator('header').getByRole('button', { name: /^通知/ })
}

/** 鈴鐺（或側欄連結）裡的未讀數字徽章 */
function badgeIn(scope: Locator): Locator {
  return scope.getByTestId('notification-badge')
}

/** 重新整理直到條件成立（通知在背景寫入，數字要重新讀頁面才會更新） */
async function reloadUntil(page: Page, check: () => Promise<void>) {
  await expect(async () => {
    await page.reload()
    await check()
  }).toPass({ timeout: NOTIFY_TIMEOUT })
}

/** 教練端「預約管理」的預約卡片（以服務名稱辨識） */
function tenantCard(page: Page, serviceName: string): Locator {
  return page.locator('[data-slot="card"]').filter({ hasText: serviceName })
}

test.describe('學員端', () => {
  test.use({ viewport: DESKTOP })

  test('1+2. 教練取消預約（學員沒有允許推播）→ 鈴鐺數字 → 小視窗 → 通知頁看到原因 → 點進明細 → 數字歸零', async ({
    page,
    context,
  }) => {
    // 這一案步驟多（兩次登入、多次換頁），在剛啟動的 dev server 上會超過預設的 30 秒
    test.setTimeout(90_000)

    // 教練在畫面上取消學員已確認的預約
    await login(page, ctx.owner.email)
    await page.goto('/bookings')
    const card = tenantCard(page, SVC.ownerCancel)
    await card.getByRole('button', { name: '取消', exact: true }).click()
    const dialog = page.getByRole('alertdialog')
    await dialog.getByRole('textbox').fill('場地臨時整修')
    await dialog.getByRole('button', { name: '取消預約', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(card.getByText('已取消', { exact: true })).toBeVisible()
    await logout(page)

    // 學員：瀏覽器沒有允許推播
    await context.clearPermissions()
    await login(page, ctx.customer.email)
    await page.goto('/my-bookings')
    expect(await page.evaluate(() => Notification.permission)).not.toBe('granted')

    const bell = customerBell(page)
    await reloadUntil(page, async () => {
      await expect(bell).toHaveAccessibleName('通知，1 則未讀', { timeout: 1_000 })
    })
    await expect(badgeIn(bell)).toHaveText('1')

    // 點鈴鐺：跳出小視窗，不換頁；打開不會標為已讀，數字不變
    await bell.click()
    await expect(page).toHaveURL(/\/my-bookings$/)
    const popover = page.getByRole('dialog', { name: '最近的通知' })
    await expect(popover).toBeVisible()
    await expect(popover.getByText('預約已取消', { exact: true })).toBeVisible()
    await expect(bell).toHaveAttribute('aria-expanded', 'true')
    await expect(badgeIn(bell)).toHaveText('1')

    // 看全部通知 → 通知頁看到原因
    await popover.getByRole('link', { name: '看全部通知' }).click()
    await page.waitForURL('**/my-notifications')
    await expect(page.getByRole('heading', { name: '通知' })).toBeVisible()
    const row = page.getByRole('link').filter({ hasText: '預約已取消' })
    await expect(row).toContainText('原因：場地臨時整修')
    await expect(badgeIn(bell)).toHaveText('1')

    // 點那一則 → 預約明細頁
    await row.click()
    await page.waitForURL(`**/my-bookings/${ctx.bookings.ownerCancel}`)

    // 回來：數字歸零（不顯示數字）。標為已讀與換頁同時送出，重新整理直到反映
    await page.goto('/my-notifications')
    await reloadUntil(page, async () => {
      await expect(bell).toHaveAccessibleName('通知', { timeout: 1_000 })
    })
    await expect(badgeIn(bell)).toHaveCount(0)
  })

  test('3. 全部標為已讀', async ({ page }) => {
    await insertInAppNotification(ctx.customer.userId, {
      title: 'E2E 全部標為已讀之一',
      body: '測試用通知',
      url: null,
    })
    await insertInAppNotification(ctx.customer.userId, {
      title: 'E2E 全部標為已讀之二',
      body: '測試用通知',
      url: '/my-bookings',
    })

    await login(page, ctx.customer.email)
    await page.goto('/my-notifications')
    const bell = customerBell(page)
    await expect(bell).toHaveAccessibleName(/^通知，\d+ 則未讀$/)
    await expect(page.getByText('E2E 全部標為已讀之一', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: /^全部標為已讀（\d+）$/ }).click()
    await expect(page.getByRole('button', { name: /^全部標為已讀/ })).toHaveCount(0)
    await expect(bell).toHaveAccessibleName('通知')
    await expect(badgeIn(bell)).toHaveCount(0)
  })
})

test.describe('教練端', () => {
  test('4. 手機寬度：有未讀時選單按鈕有小紅點、「通知」旁有數字；全部標為已讀後兩者都消失', async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE)
    await insertInAppNotification(ctx.owner.userId, {
      title: 'E2E 教練端未讀',
      body: '測試用通知',
      url: null,
    })

    await login(page, ctx.owner.email)
    await page.goto('/notifications')
    const menu = page.getByRole('button', { name: '選單，有未讀通知' })
    await expect(menu).toBeVisible()
    await expect(page.getByTestId('menu-unread-dot')).toBeVisible()

    await menu.click()
    const navLink = page.getByRole('dialog').getByRole('link', { name: '通知', exact: true })
    await expect(badgeIn(navLink)).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: /^全部標為已讀（\d+）$/ }).click()
    await expect(page.getByRole('button', { name: /^全部標為已讀/ })).toHaveCount(0)

    const plainMenu = page.getByRole('button', { name: '選單', exact: true })
    await expect(plainMenu).toBeVisible()
    await expect(page.getByTestId('menu-unread-dot')).toHaveCount(0)
    await plainMenu.click()
    await expect(
      badgeIn(page.getByRole('dialog').getByRole('link', { name: '通知', exact: true })),
    ).toHaveCount(0)
  })

  test('5. 學員送出購買申請 → 教練端側欄「通知」數字增加 → 點那一則進到購買申請頁', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP)
    const packageName = await createServicePackage(ctx.tenantId, {
      serviceName: 'E2E 購買申請服務',
      packageName: 'E2E 五堂課',
      classCount: 5,
      price: 5000,
    })

    // 送出前教練端的未讀數（側欄沒有數字時為 0）
    await login(page, ctx.owner.email)
    await page.goto('/dashboard')
    const sideLink = () => page.locator('aside').getByRole('link', { name: '通知', exact: true })
    const badge = badgeIn(sideLink())
    const before = (await badge.count()) === 0 ? 0 : Number(await badge.innerText())
    // 99 以上會顯示「99+」，無法判斷是否增加
    expect(before).toBeLessThan(99)
    await logout(page)

    // 學員在公開頁送出購買申請
    await login(page, ctx.customer.email)
    await page.goto(`/${tenantSlugOf(ctx)}/packages`)
    const pkgCard = page
      .locator('div.rounded-2xl')
      .filter({ has: page.getByRole('heading', { level: 3, name: packageName, exact: true }) })
    await pkgCard.getByRole('button', { name: /購買/ }).click()
    await pkgCard.getByRole('button', { name: '送出申請' }).click()
    await expect(page.getByText(`「${packageName}」申請已送出，等教練核准`)).toBeVisible()
    await logout(page)

    // 教練端：側欄「通知」數字增加
    await login(page, ctx.owner.email)
    await page.goto('/dashboard')
    await reloadUntil(page, async () => {
      await expect(badgeIn(sideLink())).toHaveText(String(before + 1), { timeout: 1_000 })
    })

    // 點那一則 → 購買申請頁
    await sideLink().click()
    await page.waitForURL('**/notifications')
    const row = page.getByRole('link').filter({ hasText: '新的購買申請' }).first()
    await expect(row).toContainText(packageName)
    await row.click()
    await page.waitForURL('**/packages/pending')
    await expect(page.getByRole('heading', { name: /購買申請/ })).toBeVisible()
  })
})
