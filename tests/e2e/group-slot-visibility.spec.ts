import { test, expect } from '@playwright/test'
import { login } from './helpers'
import {
  GSV_SERVICE_NAME,
  cleanupBfv2E2e,
  countActiveBookings,
  setupGroupVisibilityE2e,
  type GroupVisibilityE2e,
} from './bfv2-fixture'

/**
 * 團班時段可見性：團班已有一位學員預約（時段狀態變成待確認）後，
 * 第二位學員仍能從教練公開頁看到這個時段、人數正確，並且約得進去。
 *
 * 需要 supabase/migrations/20261126110000_group_slot_visibility_functions.sql 與
 * 20261126110100_group_slot_visibility_policy.sql 都已執行，否則會紅。
 *
 * 會寫入資料庫：測試資料全部由 bfv2-fixture.ts 在 beforeAll 建立（獨立的 bfv2e2e- 租戶與帳號），
 * afterAll 清掉；不使用、也不修改 demo 帳號的資料。
 */

let ctx: GroupVisibilityE2e

test.beforeAll(async () => {
  test.setTimeout(180_000)
  ctx = await setupGroupVisibilityE2e()
})

test.afterAll(async () => {
  test.setTimeout(120_000)
  await cleanupBfv2E2e()
})

test('第二位學員從公開頁看得到並約得進團班，人數正確', async ({ page }) => {
  await login(page, ctx.second.email)

  // 公開頁以時段開始時間的 UTC 日期分組，直接用網址帶服務與日期
  await page.goto(`/${ctx.slug}?service=${ctx.serviceId}&date=${ctx.slotDate}`)

  // 時段按鈕（TimeChip）：顯示台灣時間，團班另外顯示「已報名/名額」
  const chip = page.locator('button[aria-pressed]').filter({ hasText: ctx.slotTimeLocal })
  await expect(chip).toHaveCount(1)
  await expect(chip).toContainText('1/3')

  await chip.click()
  await page.getByRole('link', { name: '前往預約' }).click()
  await page.waitForURL(`**/book/${ctx.slotId}`)

  // 確認頁正常顯示，不是「時段已不可預約」
  await expect(page.getByText('預約確認').first()).toBeVisible()
  await expect(page.getByText('時段已不可預約')).toHaveCount(0)
  await expect(page.getByText('目前無法取得時段資料')).toHaveCount(0)

  await page.getByRole('button', { name: '送出預約申請' }).click()
  await page.waitForURL('**/my-bookings?booked=*')
  await expect(
    page.getByRole('heading', { level: 3, name: GSV_SERVICE_NAME, exact: true }),
  ).toBeVisible()

  expect(await countActiveBookings(ctx.slotId)).toBe(2)
})
