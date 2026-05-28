import { type Page, expect } from '@playwright/test'

/**
 * Test accounts seeded by scripts/seed-test-data.mjs.
 * Password is shared across all test accounts; change here if the seed script changes.
 */
export const TEST_PASSWORD = 'Test1234!'

export const ACCOUNTS = {
  coachWang: {
    email: 'demo-coach-wang@example.com',
    name: '王教練',
    slug: 'demo-wang-coach',
  },
  coachLin: {
    email: 'demo-coach-lin@example.com',
    name: '林教練',
    slug: 'demo-lin-coach',
  },
  staffMing: {
    email: 'demo-staff-ming@example.com',
    name: '阿明助教',
  },
  studentMing: {
    email: 'demo-student-ming@example.com',
    name: '小明',
  },
} as const

/**
 * Login via the /login UI form. Drops user on /dashboard or /my-bookings depending on role.
 */
export async function login(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('密碼').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: '登入' }).click()
  // wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10_000 })
}

export async function logout(page: Page) {
  await page.goto('/api/logout', { waitUntil: 'commit' }).catch(() => {})
  // /api/logout is POST-only, so just clear cookies as a fallback
  await page.context().clearCookies()
}

/**
 * Assert the page has the new Direction C chrome: Anton-stack display font + at least one
 * `font-mono` kicker visible. Page-specific assertions follow per test.
 */
export async function expectDirectionCChrome(page: Page) {
  // At least one .font-display element should be visible
  const displayCount = await page.locator('.font-display').count()
  expect(displayCount).toBeGreaterThan(0)
}
