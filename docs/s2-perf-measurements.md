# S2 — 效能量測

**量測點**：台灣 / Chrome 最新版 / production URL
**流程**：每路徑同操作連續 5 次，第 3、4、5 次取中位為 warm hit；第 1 次為 cold hit 參考。
**工具**：Chrome DevTools Performance + Network tab，看 server timing。

> 此檔為 scaffold — 等 Vercel READY 後使用者在瀏覽器跑量測並填入下表。

## 量測表

| 路徑 | 動作 | cold ms | warm 中位 ms | 達標 (≤ 500ms)? | 瓶頸 |
|---|---|---|---|---|---|
| /calendar | view 切換（週 → 日） | | | | client-only |
| /calendar | view 切換（週 → 列表） | | | | client-only |
| /calendar | 換週（◄ / ►） | | | | server fetch + skeleton |
| /[slug] | 切日期 | | | | API + CDN cache |
| /[slug] | 切服務 | | | | API fresh fetch |
| /platform/tenants | 開啟 | | | | Suspense list stream |
| /platform/tenants/[id] | 開啟 | | | | 5 streamed blocks |

## Exception 清冊（warm 中位數 > 500ms 的路徑）

| 路徑 | warm ms | 原因 | 處理時機 |
|---|---|---|---|

> 清冊**可以為空**，但檔案必須存在 — 代表我們驗收過、知道哪些路徑超標、何時處理。
> 完成量測後，把 warm 中位 > 500ms 的列移到這裡並填寫原因（Supabase 冷連線 / 缺 covering index / cron 排程 etc.）與處理時機（S3 / S4 / S6）。

---

## 量測 flow（給跑量測的人看）

對每條重點路徑：
1. production URL，連續操作 5 次
2. 紀錄第 3, 4, 5 次中位數作為 warm hit
3. 同步紀錄第 1 次作為 cold hit 參考
4. 寫入上表

對「達標」欄：
- ✓ 表示 warm 中位數 ≤ 500ms
- ✗ 表示超標，請於 Exception 清冊補一列
- — 表示「不適用」(e.g. client-only operation has no server timing)
