# 角色操作教學影片（Playwright 自動錄製）— 設計文件

- 日期：2026-06-05
- 狀態：待 review
- 目標：用 Playwright 自動以「教練 / 助教 / 學員 / 平台」四種角色登入，走完**每一個可存取的頁面與功能**，產出帶中文字幕的無聲操作教學影片。

---

## 1. 目標與範圍

### 必達
- 四個角色各一支完整操作影片（`.webm`）。
- **涵蓋全部 26 個路由頁面**（見 §4 覆蓋對照表），不漏頁。
- 中文字幕橫幅（畫面內注入），每步驟有可讀說明 + 停頓。
- 真實操作（寫入資料）：學員送出預約、教練確認預約等，全程只動 `demo-` 測試租戶。
- 一鍵流程：`npm run tutorial:record` 先重置 seed → 再錄製 → 影片進 `tutorials/`。

### 不做（YAGNI）
- 真人旁白配音（影片為無聲 + 字幕；之後可另行配音）。
- Email 通道相關示範（依專案既有決定，Email 通道不做）。
- 跨瀏覽器（只用 Chromium）。

---

## 2. 架構（4 個元件）

### 2.1 專用錄製設定 `playwright.tutorial.config.ts`
獨立於既有 `playwright.config.ts`，避免污染 CI smoke test。

```
testDir: './tests/tutorials'
fullyParallel: false, workers: 1          // 順序錄，避免共用帳號競爭
use: {
  baseURL: process.env.TUTORIAL_BASE_URL ?? 'http://localhost:3000'
  viewport: { width: 1440, height: 900 }
  video: 'on'                              // 全程錄影
  launchOptions: { slowMo: 400 }           // 放慢每個動作
  trace: 'off', screenshot: 'off'
}
outputDir: './tutorials/.raw'              // Playwright 原始輸出
```

`headless` 預設沿用 Playwright（headless 也能錄影）；可用 `TUTORIAL_HEADED=1` 改 headed 觀看。

### 2.2 旁白/標註 helper `tests/tutorials/tutorial-helpers.ts`
無聲影片靠注入 DOM 當「字幕」。

- `narrate(page, title, desc, ms = 1800)`：在畫面頂端注入固定定位的字幕橫幅（深底白字 + 中文標題 + 說明），停頓 `ms` 讓觀眾讀完。同一支影片重複使用同一個 banner 容器（更新文字而非重建）。
- `highlight(page, locator)`：點擊前替目標元素加上外框 outline（注入暫時 class / box-shadow），讓視線好跟；操作後移除。
- `clickWithCue(page, locator, label)`：`highlight` → 短停 → `click` 的組合包。
- `pace(page, ms)`：純停頓，用於頁面切換之間。
- 影片重新命名：在 `test.afterEach` / fixture 中，把 Playwright 存到 `tutorials/.raw/**/video.webm` 的檔案複製為可讀檔名（如 `tutorials/01-教練-完整操作.webm`）。

字幕語言：**中文**。

### 2.3 四支教學腳本 `tests/tutorials/*.tutorial.spec.ts`
每支為單一 `test()`（一鏡到底），用 `narrate` 串起所有頁面。帳號沿用 `tests/e2e/helpers.ts` 的 `ACCOUNTS` 與 `login()`。

- `coach.tutorial.spec.ts` — 王教練（demo-coach-wang）
- `staff.tutorial.spec.ts` — 阿明助教（demo-staff-ming）
- `customer.tutorial.spec.ts` — 小明（demo-student-ming）
- `platform.tutorial.spec.ts` — terry@gmail.com（密碼由 `TUTORIAL_PLATFORM_PASSWORD` env 帶入；缺少時該支自動 skip 並提示）

### 2.4 流程編排 `npm run tutorial:record`
順序：
1. `node scripts/seed-test-data.mjs` — 重置 demo 資料到已知狀態（冪等，只清 `demo-` 租戶）。
2. （新增）為 小明 預先 seed 一筆有效 purchase/套裝，使其可直接送出預約（避免影片卡在「先去申請套裝」；申請套裝另在學員流程中單獨示範一段）。
3. `playwright test -c playwright.tutorial.config.ts`。
4. 影片整理到 `tutorials/`。

可分角色錄製：`npm run tutorial:record -- customer` 之類（傳給 playwright 的檔名過濾）。

---

## 3. 資料安全與順序

- 全程僅操作 `demo-` 前綴測試租戶與測試帳號；不接觸真實客戶資料。
- 錄製前一律重新 seed，確保「待確認預約」「可預約時段」等狀態存在。
- **錄製順序固定**：先 `customer`（送出新預約）→ 後 `coach`（確認預約）。兩支指向同一筆 booking，串成完整故事；或各自指向 seed 提供的不同預約，避免互相吃單。實作時以「seed 提供足量 pending 預約 + 開放時段」確保兩支都有素材。
- Platform 用真實管理員帳號，僅做唯讀瀏覽 + 安全的篩選操作，不刪租戶/不改設定。

---

## 4. 頁面覆蓋對照表（全 26 路由）

### 共用 / 公開
| 路由 | 由哪支影片涵蓋 | 動作 |
|---|---|---|
| `(auth)/login` | 全部四支開頭 | 登入示範 |
| `(auth)/signup` | coach（片頭附帶） | 填註冊表單示範；**不最終送出**（避免產生垃圾帳號），或送出後於 seed 清除 |
| `invite/[token]` | staff | 教練產生邀請連結 → 助教接受邀請頁 |

### 教練 王教練（全部 (tenant) 頁面）
| 路由 | 動作 |
|---|---|
| `(tenant)/dashboard` | KPI、今日預約、待確認概覽 |
| `(tenant)/calendar` | 切 week/month/list 三視圖、點 slot 開 popover |
| `(tenant)/calendar/availability` | 可預約時段模板 |
| `(tenant)/calendar/rules` | 重複規則 |
| `(tenant)/services` | 1-on-1 / Group 分頁，瀏覽服務 |
| `(tenant)/packages` | 套票列表（ALL/DRAFT 分頁） |
| `(tenant)/packages/pending` | 待審核套票申請 |
| `(tenant)/customers` | 搜尋、狀態篩選、開 drawer |
| `(tenant)/bookings` | **確認一筆待確認預約**（按「確認」，實際寫入） |
| `(tenant)/staff` | 助教管理、產生邀請連結 |
| `(tenant)/notifications` | 通知收件匣 4 分頁 |
| `(tenant)/settings/profile` | 個人/品牌設定 6 區塊 |
| `(tenant)/settings/notifications` | 通知偏好矩陣 + 勿擾時段 |

### 助教 阿明（(tenant) 子集，依權限）
| 路由 | 動作 |
|---|---|
| `invite/[token]` | 接受邀請、完成加入 |
| 可存取的 (tenant) 頁面 | 逐頁瀏覽（dashboard / calendar / bookings / customers …）。**無權限頁面會 redirect** — 影片中如實呈現權限邊界（哪些看得到、哪些被導開）。實作時先以程式探測 staff 實際可達頁面，再據此編排。 |

### 學員 小明（customer + 公開）
| 路由 | 動作 |
|---|---|
| `(customer)/my-bookings` | KPI 列、DateStrip 分組、預約列表 |
| `[tenantSlug]` | 教練公開頁：簡介、時段 DateRibbon/TimeChip |
| `[tenantSlug]/packages` | 公開套票瀏覽、**申請套裝**（示範取得預約資格） |
| `[tenantSlug]/purchases` | 我的購買/套裝狀態 |
| `book/[slotId]` | 選時段 → 填表 → **送出預約申請**（實際寫入，狀態待確認） |
| `(customer)/account/notifications` | 帳號通知偏好 |

### 平台 terry（platform）
| 路由 | 動作 |
|---|---|
| `(platform)/platform/dashboard` | 6 KPI |
| `(platform)/platform/tenants` | 租戶列表 |
| `(platform)/platform/tenants/[tenantId]` | 點進單一租戶詳情 |
| `(platform)/platform/bookings` | 全平台預約、pill 篩選 |

> 覆蓋檢核：上述對照表涵蓋 §開頭 `find page.tsx` 列出的全部 26 路由。實作完成後跑一個 coverage 斷言（比對 spec 內實際 `goto` 過的路由 vs 全路由清單），缺漏則 fail。

---

## 5. 成品與輸出

- `tutorials/01-教練-完整操作.webm`
- `tutorials/02-助教-完整操作.webm`
- `tutorials/03-學員-完整操作.webm`
- `tutorials/04-平台-完整操作.webm`
- 可選：偵測到本機有 `ffmpeg` 時，加 `npm run tutorial:mp4` 轉成 `.mp4`；無 ffmpeg 則略過並提示安裝方式。
- `tutorials/.raw/` 與 `tutorials/.gitignore`：影片產物加入 `.gitignore`，不進版控。

---

## 6. 測試與驗證

- 錄製本身即 e2e 流程：每個 `narrate` 步驟前後用既有的 `expect(...).toBeVisible()` 斷言，確保頁面真的到位（沒到位 = 影片會錄到錯誤畫面，所以斷言失敗即終止）。
- Coverage 斷言（§4 末）確保 26 路由全到。
- 在 `playwright.config.ts`（既有 CI smoke）**不納入** `tests/tutorials`，避免 CI 變慢／嘗試寫資料。
- 本機驗收：`npm run dev` + `npm run tutorial:record`，人工抽看四支影片字幕與操作正確。

---

## 7. 風險與緩解

| 風險 | 緩解 |
|---|---|
| 學員預約需先有套裝 | seed 預先給 小明 一筆有效 purchase；申請套裝流程另錄一段示範 |
| 教練「確認」吃掉學員 pending → 兩支互相影響 | 固定錄製順序 + seed 提供足量 pending／開放時段 |
| Platform 需真實管理員密碼 | 由 `TUTORIAL_PLATFORM_PASSWORD` env 帶入；缺少則該支 skip |
| signup / invite 會產生真實資料 | signup 不最終送出或事後清除；invite token 由教練流程即時產生、用後失效 |
| slowMo + 字幕停頓使影片偏長 | 每支控制在合理長度；`narrate` 停頓時間可調參數 |
| 既有頁面結構與 e2e 斷言漂移 | 沿用 `tests/e2e` 已驗證過的 selector，降低脆弱度 |

---

## 8. 開放問題（實作前確認）
- 無（範圍已於 brainstorm 收斂：四角色、全頁面、真實操作、中文字幕、無旁白）。
