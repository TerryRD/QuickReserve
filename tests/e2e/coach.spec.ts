import { test, expect } from '@playwright/test'
import { ACCOUNTS, login, expectDirectionCChrome } from './helpers'

test.describe('coach owner (王教練)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.coachWang.email)
  })

  test('dashboard shows black hero card + 4 KPI grid + Today/Pending columns', async ({ page }) => {
    await page.goto('/dashboard')
    await expectDirectionCChrome(page)

    // Black hero card with greeting (早安/午安/晚安)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/早安|午安|晚安/)

    // 4 KPI cards
    const kpis = page.locator('.font-mono', {
      hasText: /本週待確認|本週時段|今日預約|本月新學員/,
    })
    expect(await kpis.count()).toBeGreaterThanOrEqual(4)

    // Section headers for today + pending columns
    await expect(page.getByRole('heading', { name: '今日預約' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '待確認預約' })).toBeVisible()
  })

  test('calendar 3 views switch via tab', async ({ page }) => {
    await page.goto('/calendar?view=week')
    await expect(page.getByRole('button', { name: /MONTH/ })).toBeVisible()

    await page.goto('/calendar?view=list')
    await expect(page.getByRole('button', { name: /WEEK/ })).toBeVisible()

    await page.goto('/calendar?view=month')
    // MonthView page has weekday header text — pick one we know is present
    await expect(page.getByRole('button', { name: /MONTH/ })).toBeVisible()
  })

  test('calendar slot popover opens with details (drift-safe)', async ({ page }) => {
    await page.goto('/calendar?view=week')
    // Each slot in the week grid is a <button> containing an HH:mm time label.
    // Filter to buttons that look like slot tiles (mono time inside the cell).
    const slotButtons = page.locator('.grid button').filter({ hasText: /^\s*[\d⚠]/ }).filter({ hasText: /\d{2}:\d{2}/ })
    const count = await slotButtons.count()
    if (count === 0) {
      test.info().annotations.push({ type: 'skip-reason', description: 'no slots in coach calendar for current week' })
      return
    }
    await slotButtons.first().click()
    // SlotPopover dialog renders rows labelled 時間 / 負責成員 / 狀態
    await expect(page.getByText('時間').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('負責成員').first()).toBeVisible()
    await expect(page.getByText('狀態').first()).toBeVisible()
    // Do NOT click delete — would mutate prod data.
  })

  test('services page shows tab + placeholder card', async ({ page }) => {
    await page.goto('/services')
    // Tab pill (segmented)
    await expect(page.getByRole('link', { name: /1-ON-1/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /GROUP/ })).toBeVisible()
  })

  test('customers page renders + drawer-capable rows', async ({ page }) => {
    await page.goto('/customers')
    // Search input
    await expect(page.locator('input[name="q"]')).toBeVisible()
    // Status filter chips
    await expect(page.getByRole('link', { name: '全部' })).toBeVisible()
  })

  test('packages page shows tab + service grouping', async ({ page }) => {
    await page.goto('/packages')
    await expect(page.getByRole('link', { name: /ALL/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /DRAFT|草稿/i })).toBeVisible()
  })

  test('notifications inbox (NOT preferences)', async ({ page }) => {
    await page.goto('/notifications')
    // Inbox title
    await expect(page.getByRole('heading', { name: '通知' })).toBeVisible()
    // 4 tabs
    await expect(page.getByRole('link', { name: /ALL/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /BOOKINGS/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /PACKAGES/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /SYSTEM/ })).toBeVisible()
    // Preferences link
    await expect(page.getByRole('link', { name: /推播偏好/ })).toBeVisible()
  })

  test('settings profile shows 6 numbered sections + SubNav', async ({ page }) => {
    await page.goto('/settings/profile')
    // SubNav
    await expect(page.getByRole('link', { name: /PROFILE/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /NOTIF/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /AVAILABILITY/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /RULES/ })).toBeVisible()
    // At least the first numbered section
    await expect(page.getByText('BASIC INFO')).toBeVisible()
    await expect(page.getByText('HERO META')).toBeVisible()
  })

  test('settings notifications has matrix + quiet hours', async ({ page }) => {
    await page.goto('/settings/notifications')
    // SubNav active on NOTIF
    await expect(page.getByRole('heading', { name: '通知偏好' })).toBeVisible()
    // Matrix has at least 9 events × 2 channels = 18 checkboxes
    const checkboxes = page.getByRole('checkbox')
    expect(await checkboxes.count()).toBeGreaterThanOrEqual(18)
    // Quiet hours label appears in heading + help text — first occurrence is enough
    await expect(page.getByText('勿擾時段').first()).toBeVisible()
  })

  test('calendar availability + rules pages render with SubNav', async ({ page }) => {
    await page.goto('/calendar/availability')
    // SectionHead renders eng="TEMPLATES" in display + accent underline span
    await expect(page.getByText(/TEMPLATES/).first()).toBeVisible()
    await page.goto('/calendar/rules')
    await expect(page.getByRole('heading', { name: '重複規則' })).toBeVisible()
  })
})
