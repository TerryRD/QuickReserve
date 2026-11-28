/**
 * 把 Playwright 的瀏覽器安裝位置指到 QuickReserve 專屬資料夾。
 *
 * 為什麼：Playwright 預設把所有專案的瀏覽器放在同一個使用者層級資料夾。同一台機器上
 * 別的專案執行安裝時，會把「它用不到的版本」回收掉，本專案的瀏覽器就跟著不見。
 * 改放專屬資料夾後，別的專案的安裝與回收都碰不到這裡。
 *
 * 載入本檔即生效（要在 Playwright 載入之前）。使用處：
 *   - playwright.config.ts、playwright.tutorial.config.ts（測試在 worker 啟動瀏覽器）
 *   - scripts/perf-audit.mjs（直接啟動瀏覽器）
 *   - package.json 的 test:e2e:install、test:e2e:ui（用 node -r 預先載入）
 *
 * 不會覆蓋的情況：
 *   - 已自行設定 PLAYWRIGHT_BROWSERS_PATH → 以該設定為準
 *   - CI（環境變數 CI 有值）→ 維持 Playwright 預設位置，GitHub Actions 行為不變
 *
 * 資料夾位置（依使用者與作業系統推得，各 worktree 共用同一份，不在 repo 內）：
 *   - Windows：%LOCALAPPDATA%\ms-playwright-quickreserve
 *   - macOS：~/Library/Caches/ms-playwright-quickreserve
 *   - Linux：$XDG_CACHE_HOME 或 ~/.cache 底下的 ms-playwright-quickreserve
 */
const os = require('node:os')
const path = require('node:path')

const FOLDER_NAME = 'ms-playwright-quickreserve'

function userCacheDir() {
  if (process.platform === 'win32') {
    return process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Caches')
  }
  return process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache')
}

if (!process.env.PLAYWRIGHT_BROWSERS_PATH && !process.env.CI) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(userCacheDir(), FOLDER_NAME)
}
