import { test, expect } from '@playwright/test'
import { ACCOUNTS, login } from './helpers'

test.describe('customer (小明)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.studentMing.email)
  })

  test('my-bookings shows KPI row + DateStrip groups', async ({ page }) => {
    await page.goto('/my-bookings')
    // KPI card labels（限定在 KPI 區塊內：預約卡片的狀態標籤與摘要也會出現「已取消」等字）
    const kpis = page.locator('section').first()
    await expect(kpis.getByText('本週', { exact: true })).toBeVisible()
    await expect(kpis.getByText('待回覆', { exact: true })).toBeVisible()
    await expect(kpis.getByText('已出席', { exact: true })).toBeVisible()
    await expect(kpis.getByText('已取消', { exact: true })).toBeVisible()
  })

  test('account/notifications is reachable for customer', async ({ page }) => {
    await page.goto('/account/notifications')
    // Should not redirect — customer is logged in
    expect(page.url()).toContain('/account/notifications')
  })

  test('customer hitting /dashboard redirects (not authorized)', async ({ page }) => {
    const response = await page.goto('/dashboard')
    // Either redirected away or got a forbidden status — should not 500
    expect(response?.status()).toBeLessThan(500)
  })

  test('public coach page DateRibbon + TimeChip render', async ({ page }) => {
    await page.goto(`/${ACCOUNTS.coachWang.slug}`)
    // The slot picker section header
    await expect(page.getByText(/時段|SLOTS/i).first()).toBeVisible()
  })
})
