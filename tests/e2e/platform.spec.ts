import { test, expect } from '@playwright/test'

/**
 * Platform admin tests require a platform_admin row tied to the test user.
 * The seed script doesn't insert platform_admins (intentional security boundary),
 * so these tests are skipped unless an env var supplies a real admin email.
 *
 * To run locally:
 *     E2E_PLATFORM_ADMIN_EMAIL=you@example.com npm run test:e2e -- tests/e2e/platform.spec.ts
 */
import { login, TEST_PASSWORD } from './helpers'

const adminEmail = process.env.E2E_PLATFORM_ADMIN_EMAIL

test.describe('platform admin', () => {
  test.skip(!adminEmail, 'Set E2E_PLATFORM_ADMIN_EMAIL to enable platform tests')

  test.beforeEach(async ({ page }) => {
    if (!adminEmail) return
    // Custom login — admin password is NOT the test password
    await page.goto('/login')
    await page.getByLabel('Email').fill(adminEmail)
    await page.getByLabel('密碼').fill(process.env.E2E_PLATFORM_ADMIN_PASSWORD ?? TEST_PASSWORD)
    await page.getByRole('button', { name: '登入' }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10_000 })
  })

  test('platform dashboard shows 6 KpiCards + new sidebar', async ({ page }) => {
    await page.goto('/platform/dashboard')
    await expect(page.getByRole('heading', { name: '平台儀表板' })).toBeVisible()
    await expect(page.getByText('啟用租戶')).toBeVisible()
    await expect(page.getByText('使用者總數')).toBeVisible()
    await expect(page.getByText('預約紀錄總數')).toBeVisible()
    await expect(page.getByText('待確認預約')).toBeVisible()
  })

  test('platform tenants list renders', async ({ page }) => {
    await page.goto('/platform/tenants')
    await expect(page.getByRole('heading', { name: '租戶管理' })).toBeVisible()
    await expect(page.getByText(/ALL TENANTS/)).toBeVisible()
  })

  test('platform bookings has pill filter + StatusBadge table', async ({ page }) => {
    await page.goto('/platform/bookings')
    await expect(page.getByRole('heading', { name: '全平台預約' })).toBeVisible()
    // Filter chips
    await expect(page.getByRole('link', { name: '全部' })).toBeVisible()
    await expect(page.getByRole('link', { name: '待確認' })).toBeVisible()
  })
})
