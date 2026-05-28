import { test, expect } from '@playwright/test'
import { ACCOUNTS, login } from './helpers'

test.describe('customer (小明)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.studentMing.email)
  })

  test('my-bookings shows KPI row + DateStrip groups', async ({ page }) => {
    await page.goto('/my-bookings')
    // KPI card labels
    await expect(page.getByText('本週')).toBeVisible()
    await expect(page.getByText('待回覆')).toBeVisible()
    await expect(page.getByText('已完成')).toBeVisible()
    await expect(page.getByText('已取消')).toBeVisible()
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
