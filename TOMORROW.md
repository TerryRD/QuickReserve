# 明天開機要做的事（2026-05-24 → 2026-05-25）

## TL;DR — 給 Claude 看的一行

> S2 spec 已寫好已 commit (`f8188af`)，請進 `docs/superpowers/specs/2026-05-24-s2-perf-rwd-design.md` 確認後直接 invoke `superpowers:writing-plans` 產出 S2 plan，然後用 `superpowers:subagent-driven-development` 執行。執行模式與 S1 相同。

## 起手式

```text
打開 Claude Code，第一句說：
「繼續 S2，按 TOMORROW.md 走」
```

## 目前狀態（2026-05-24 收工時）

### ✅ 已完成

- **S1 bug triage**：14 個 commit 全 production deployed（`cea8898`），server 端驗證 pass。瀏覽器互動驗收待你跑（細項見下方「S1 殘留視覺驗收」）
- **Dependabot 清理**：postcss CVE-2026-41305 透過 overrides 修了（advisory state = `fixed`）；5 個 PR merged（shadcn 4.8、react 19.2.6、react-dom 19.2.6、react-hook-form 7.76.1、@hookform/resolvers 5.4.0、ws 8.21.0）；vitest major 已關掉並加進 ignore；prettier 全域 autofix（46 檔）
- **S2 brainstorm**：spec 完成，commit `f8188af`，路徑見上面

### 🔜 S2 plan + 實作（明天 from-zero）

1. **複審 spec**（5 分鐘）：開啟 `docs/superpowers/specs/2026-05-24-s2-perf-rwd-design.md`，看 §2 範圍 / §11 FR 編號 / §10 風險表三段；OK 就跟 Claude 說「spec OK 出 plan」
2. **產 plan**：Claude 會 invoke writing-plans skill 自動產出 `docs/superpowers/plans/2026-05-25-s2-perf-rwd.md`
3. **執行**：選 Subagent-Driven Development（與 S1 同模式），Claude 會逐 task dispatch implementer + spec reviewer + code reviewer，最後 push

### 🧪 S1 殘留視覺驗收（你需要瀏覽器親跑）

下次有空跑一輪 `npm run dev`，按以下 4 項視覺確認（其餘 8 項都已 server 端驗證 pass）：

| # | 操作 | 預期 |
|---|---|---|
| 1 | `/platform/tenants` 邀請欄打 `TerryTest` | Slug 欄即時變 `terrytest`（純 JS onChange） |
| 2 | 同上 submit 空 email | Email 欄下紅字 inline error（FormFieldErrors 顯示） |
| 3 | 教練 toggle 通知偏好開關存檔 | Toast「設定已儲存」(sonner) |
| 4 | Hard reload `/platform/tenants` 等 4 個平台頁 | Skeleton 閃一下後出現真實內容 |

發現問題回報，我修。

## 接下來的 S 子專案順序

| 子專案 | 內容 | 狀態 |
|---|---|---|
| S1 | 緊急 bug triage | ✅ 完成 |
| **S2** | **效能 + RWD 兩輪** | **明天做** |
| S3 | 行事曆與可用性管理（教練可上課時段、unavailable events、林教練測試資料） | 待 |
| S4 | 服務與商品模型擴充（團班最少人數、套裝課程、軟刪除規範化） | 待 |
| S5 | 教練介紹頁模板（照片 / 影片）、學員登入流程釐清 | 待 |
| S6 | 主題色 / 字型統一、20 年資歷視角的 UI/UX + 架構 / 資安 review | 待 |

## 重要原則（給 Claude 看的）

- 直接在 `master` 上工作（專案慣例，前 7 個 plan + S1 都這樣）
- HEREDOC commit message + `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- Subagent-Driven flow：implementer (sonnet) → spec reviewer (sonnet) → code quality reviewer (sonnet)
- 完成後 push origin master 並等 Vercel READY 才算結束
- 文件更新 follow [`memory/feedback_docs_after_impl.md`](../../Users/terry/.claude/projects/C--VisualDev-QuickReserve/memory/feedback_docs_after_impl.md)：每 plan 收尾要更新 README + 附錄 C + 相關 audit / measurement 文件
