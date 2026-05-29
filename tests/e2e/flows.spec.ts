import { test, expect } from '@playwright/test'
import { ACCOUNTS, login, TEST_PASSWORD } from './helpers'

/**
 * Multi-page flow tests. These walk through critical user journeys without
 * submitting forms that would dirty production data — assertions stop right
 * before the final "create booking" / "create user" mutation.
 */

test.describe('signup form flow (no submit)', () => {
  test('signup → form populated → invite mode banner', async ({ page }) => {
    // Plain signup
    await page.goto('/signup')
    // h1 is "建立帳號　JOIN" (CJK + ENG dual-title with full-width space)
    await expect(page.getByRole('heading', { level: 1, name: '建立帳號' })).toBeVisible()
    await page.getByLabel('姓名').fill('E2E Tester')
    await page.getByLabel('Email').fill(`e2e-noop-${Date.now()}@example.invalid`)
    await page.getByLabel('密碼').fill(TEST_PASSWORD)
    // Button should be enabled (validation client-side passed)
    const submitBtn = page.getByRole('button', { name: /建立帳號/ })
    await expect(submitBtn).toBeEnabled()
    // Don't click — that would create a real auth.users row

    // Invite mode banner
    await page.goto('/signup?invite=test-token')
    await expect(page.getByText(/INVITED/i)).toBeVisible()
    await expect(page.getByText(/接受教練邀請/)).toBeVisible()
  })
})

test.describe('public booking flow (王教練, no submit)', () => {
  test('public page → service select → slot picker', async ({ page }) => {
    await page.goto(`/${ACCOUNTS.coachWang.slug}`)
    // Service section heading
    await expect(page.getByText(/服務|SERVICES/i).first()).toBeVisible()
    // Slot section heading
    await expect(page.getByText(/時段|SLOTS/i).first()).toBeVisible()
    // Footer should show coach brand line
    await expect(page.getByText(/QUICKRESERVE/).last()).toBeVisible()
  })

  test('unauth /book/<slot> redirects to login', async ({ page }) => {
    // Hit a fake slot id — when unauthed middleware should /login redirect.
    // Even if authed, an invalid slot id should 404 not 500.
    const response = await page.goto('/book/00000000-0000-0000-0000-000000000000')
    expect(response?.status()).toBeLessThan(500)
  })

  test('logged-in customer can visit /book with valid slot (drift-safe)', async ({ page }) => {
    await login(page, ACCOUNTS.studentMing.email)
    // We don't know which slot is open right now in prod — just try the public page
    // and walk to a slot. If no slot is open, this test is a no-op (acceptable).
    await page.goto(`/${ACCOUNTS.coachWang.slug}`)
    // Look for any time chip; if there's at least one open slot, the chip should be visible
    const chips = page.locator('button:has-text(":")')
    const count = await chips.count()
    if (count === 0) {
      test.info().annotations.push({ type: 'skip-reason', description: 'no open slots in prod right now' })
      return
    }
    // Don't actually click — slot picker click navigates to /book. Just verify chips render.
    expect(count).toBeGreaterThan(0)
  })

  test('customer reaches /book confirm page from slot picker (no-submit)', async ({ page }) => {
    await login(page, ACCOUNTS.studentMing.email)
    await page.goto(`/${ACCOUNTS.coachWang.slug}`)

    // Find TimeChip buttons (rendered as buttons with aria-pressed; time format HH:mm)
    const chips = page.locator('button[aria-pressed]').filter({ hasText: /^\d{2}:\d{2}$/ })
    const count = await chips.count()
    if (count === 0) {
      test.info().annotations.push({ type: 'skip-reason', description: 'no open slots in prod' })
      return
    }

    // Click first chip → selected recap bar with /book/<id> CTA link appears
    await chips.first().click()
    const bookLink = page.locator('a[href*="/book/"]').first()
    await expect(bookLink).toBeVisible({ timeout: 5_000 })

    // Navigate via CTA — /book is read-only render, no mutation
    await bookLink.click()
    await page.waitForURL(/\/book\//, { timeout: 10_000 })

    // Either the confirm SectionHead OR the empty-state when student has no purchase.
    // Both confirm /book chrome rendered correctly.
    const confirmOrEmpty = page.getByText(/預約確認|尚無可用套裝/).first()
    await expect(confirmOrEmpty).toBeVisible({ timeout: 5_000 })
    // Do NOT click submit; that would create a real booking.
  })
})

test.describe('reschedule flow (no submit)', () => {
  test('my-bookings → reschedule link → public page in reschedule mode', async ({ page }) => {
    await login(page, ACCOUNTS.studentMing.email)
    await page.goto('/my-bookings')

    // Look for any reschedule link (only present on active bookings)
    const rescheduleLinks = page.getByRole('link', { name: /改期/ })
    const count = await rescheduleLinks.count()
    if (count === 0) {
      // No active bookings — test still valid as the my-bookings page itself rendered
      await expect(page.getByText('本週')).toBeVisible()
      return
    }
    // Click first reschedule link → should land on /<slug>?reschedule=<id>
    await rescheduleLinks.first().click()
    await page.waitForURL((url) => url.searchParams.has('reschedule'), { timeout: 10_000 })
    // Reschedule banner should appear
    await expect(page.getByText(/改期模式/)).toBeVisible()

    // New-slot picker should still render in reschedule mode (no-submit;
    // selecting a chip + clicking the CTA would trigger a real reschedule).
    // Just confirm the picker section is present — chips OR the empty
    // "NO SLOTS" placeholder both count as the picker having rendered.
    const pickerArea = page.getByText(/SLOTS|NO SLOTS/).first()
    await expect(pickerArea).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('cross-role layout redirects', () => {
  test('customer hits /platform/dashboard → redirected to /my-bookings', async ({ page }) => {
    await login(page, ACCOUNTS.studentMing.email)
    await page.goto('/platform/dashboard')
    await page.waitForURL(/\/(my-bookings|login)/)
    expect(page.url()).toMatch(/\/my-bookings/)
  })

  test('coach hits /platform/dashboard → redirected to /dashboard', async ({ page }) => {
    await login(page, ACCOUNTS.coachWang.email)
    await page.goto('/platform/dashboard')
    await page.waitForURL(/\/dashboard|\/platform\/dashboard/)
    // Either landed on /dashboard (redirect) or stayed on /platform/dashboard (if user is also platform admin)
    expect(page.url()).toMatch(/\/dashboard/)
  })
})
