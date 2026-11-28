import { defineConfig, devices } from '@playwright/test'
// 瀏覽器放 QuickReserve 專屬資料夾，不與同機其他專案共用（原因與位置見該檔）
import './scripts/playwright-browsers-path.cjs'

/**
 * E2E smoke tests for QuickReserve.
 *
 * Browser-level coverage that complements:
 *   - tests/integration/*.ts     — Supabase RLS + RPC integration tests (Vitest)
 *   - scripts/e2e-verify.mjs     — API-level booking flow end-to-end
 *
 * 第一次在這台機器跑（或升級 Playwright 之後）要先裝瀏覽器到專屬資料夾：
 *     npm run test:e2e:install
 *
 * Run locally against `npm run dev`:
 *     npm run dev           # in one terminal
 *     npm run test:e2e      # in another
 *
 * Or against a specific URL (e.g. production):
 *     E2E_BASE_URL=https://quick-reserve-mu.vercel.app npm run test:e2e
 *
 * 正式站流程（.github/workflows/e2e.yml）：只能手動觸發，且只跑 workflow 裡明列的
 * 唯讀測試檔（白名單），會寫資料的檔（如 booking-flow-v2-p1.spec.ts）不在正式站跑。
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
