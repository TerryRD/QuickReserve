# 角色操作教學影片

以 Playwright 自動以四種角色登入、走完全部頁面與關鍵操作，產生**無聲 + 中文字幕**的 `.mp4` 教學影片。

## 成品

錄製後於 `tutorials/`（不進版控）產生：

- `01-教練-完整操作.mp4`
- `02-助教-完整操作.mp4`
- `03-學員-完整操作.mp4`
- `04-平台-完整操作.mp4`

## 需求

- Node（專案既有版本）
- **ffmpeg**（webm → mp4 必要）：`winget install ffmpeg` 或 `choco install ffmpeg`
- 本機 `npm run dev` 運行中（或以 `TUTORIAL_BASE_URL` 指向其他環境）
- 平台教學需平台管理員密碼（否則該支自動跳過）

## 重新錄製

```bash
# 終端 A：啟動應用
npm run dev

# 終端 B：錄製（重置 seed → 錄製 → 轉 mp4 → 覆蓋檢核）
# Windows PowerShell：
$env:TUTORIAL_PLATFORM_PASSWORD='平台管理員密碼'; npm run tutorial:record
# bash：
TUTORIAL_PLATFORM_PASSWORD='平台管理員密碼' npm run tutorial:record
```

### 只錄單一角色

```bash
npm run tutorial:record -- customer    # coach | customer | staff | platform
```

## 環境變數

| 變數 | 預設 | 說明 |
|---|---|---|
| `TUTORIAL_BASE_URL` | `http://localhost:3000` | 錄製目標站台 |
| `TUTORIAL_SLOWMO` | `400` | 每個動作放慢的毫秒數（影片節奏） |
| `TUTORIAL_PLATFORM_EMAIL` | `terry@gmail.com` | 平台管理員帳號 |
| `TUTORIAL_PLATFORM_PASSWORD` | （無） | 平台管理員密碼；未設時平台教學跳過 |

## 行為與安全

- 每次錄製前自動 `node scripts/seed-test-data.mjs` 重置 demo 資料；**僅操作 `demo-` 測試租戶**，不碰真實客戶資料。
- 學員端會實際「送出預約」、教練端會實際「確認預約」；平台端僅唯讀瀏覽。
- 覆蓋檢核：彙整四支造訪過的路由，對照全 26 路由清單（`tests/tutorials/routes.coverage.mjs`），印出 `路由覆蓋：N/26`。

## 相關檔案

- `playwright.tutorial.config.ts` — 錄製專用設定（video on、slowMo）
- `tests/tutorials/tutorial-helpers.ts` — 中文字幕橫幅 / 元素描邊
- `tests/tutorials/*.tutorial.spec.ts` — 四角色腳本
- `scripts/record-tutorials.mjs` — 編排（ffmpeg 前置 → seed → 錄製 → mp4 → 覆蓋）
- `docs/superpowers/specs/2026-06-05-role-tutorial-recordings-design.md` — 設計
- `docs/superpowers/plans/2026-06-05-role-tutorial-recordings.md` — 實作計畫
