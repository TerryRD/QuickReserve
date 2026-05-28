import { test, expect } from '@playwright/test'
import { ACCOUNTS, expectDirectionCChrome } from './helpers'

test.describe('public (unauth) routes', () => {
  test('landing page renders', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/QuickReserve/)
    await expectDirectionCChrome(page)
  })

  test('login page shows split layout + new Kicker', async ({ page }) => {
    await page.goto('/login')
    // SidePanel right side
    await expect(page.getByText('QUICKRESERVE / STUDENT')).toBeVisible()
    // Kicker primitive on form (hydrated client-side)
    await expect(page.getByText('STEP 01 · LOGIN')).toBeVisible()
    // h1
    await expect(page.getByRole('heading', { name: '歡迎回來' })).toBeVisible()
  })

  test('signup page shows split layout', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByText('STEP 01 · SIGN UP')).toBeVisible()
  })

  test('signedup banner appears with ?signedup=1', async ({ page }) => {
    await page.goto('/login?signedup=1')
    await expect(page.getByText(/SIGNED UP/i)).toBeVisible()
    await expect(page.getByText(/註冊成功/)).toBeVisible()
  })

  test('public coach page (王教練) renders new hero', async ({ page }) => {
    await page.goto(`/${ACCOUNTS.coachWang.slug}`)
    await expectDirectionCChrome(page)
    // tenant name should appear somewhere (multiple times — hero + footer)
    await expect(page.getByText(ACCOUNTS.coachWang.name).first()).toBeVisible()
    // footer brand
    await expect(page.getByText(/QUICKRESERVE/).first()).toBeVisible()
  })

  test('protected route redirects to login when unauth', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login\?/)
    expect(page.url()).toContain('redirect=%2Fdashboard')
  })

  test('moved customer notif route /account/notifications redirects when unauth', async ({
    page,
  }) => {
    await page.goto('/account/notifications')
    await expect(page).toHaveURL(/\/login\?/)
  })

  test('packages tenant route redirects when unauth (middleware fix)', async ({ page }) => {
    // Was returning 500 before P4-5 middleware fix; should now 307 → /login
    const response = await page.goto('/packages')
    expect(response?.status()).toBeLessThan(500)
  })
})
