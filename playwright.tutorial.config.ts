import { defineConfig, devices } from '@playwright/test'

/**
 * 教學影片錄製專用設定（與 playwright.config.ts 分離，不進 CI smoke）。
 *
 * 用法：透過 scripts/record-tutorials.mjs 編排，或手動：
 *   npm run dev
 *   npx playwright test -c playwright.tutorial.config.ts
 *
 * 原始 .webm 輸出到 tutorials/.raw，再由 record-tutorials.mjs 轉成 .mp4。
 */
export default defineConfig({
  testDir: './tests/tutorials',
  fullyParallel: false,
  workers: 1, // 共用 demo 帳號，順序錄製避免競爭
  retries: 0,
  reporter: 'list',
  timeout: 180_000, // 一鏡到底 + slowMo + 字幕停頓，放寬單測逾時
  outputDir: './tutorials/.raw',
  use: {
    baseURL: process.env.TUTORIAL_BASE_URL ?? 'http://localhost:3000',
    viewport: { width: 1440, height: 900 },
    video: 'on',
    trace: 'off',
    screenshot: 'off',
    launchOptions: { slowMo: Number(process.env.TUTORIAL_SLOWMO ?? 400) },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
})
