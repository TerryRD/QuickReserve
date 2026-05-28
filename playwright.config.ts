import { defineConfig, devices } from '@playwright/test'

/**
 * E2E smoke tests for QuickReserve.
 *
 * Browser-level coverage that complements:
 *   - tests/integration/*.ts     — Supabase RLS + RPC integration tests (Vitest)
 *   - scripts/e2e-verify.mjs     — API-level booking flow end-to-end
 *
 * Run locally against `npm run dev`:
 *     npm run dev           # in one terminal
 *     npm run test:e2e      # in another
 *
 * Or against a specific URL (e.g. production):
 *     E2E_BASE_URL=https://quick-reserve-mu.vercel.app npm run test:e2e
 *
 * Test users are seeded by scripts/seed-test-data.mjs (run once); accounts use
 * password "Test1234!" and emails prefixed "demo-".
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // shared test users — keep sequential to avoid auth races
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // sequential
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
