# 明天開機要做的事（2026-05-26 → 2026-05-27）

## TL;DR — 給 Claude 看的一行

> S5 spec 已寫好已 commit (`2d827cd`)，請進 `docs/superpowers/specs/2026-05-26-s5-coach-page-and-auth-design.md` 確認後直接 invoke `superpowers:writing-plans` 產出 S5 plan，然後用 `superpowers:subagent-driven-development` 執行。

## 起手式

```text
打開 Claude Code，第一句說：
「繼續 S5，按 TOMORROW.md 走」
```

## 目前狀態（2026-05-26 收工時）

### ✅ 已完成

- **S4 全套**：18 commits（`e5d9e84` ~ `f18840c`），FR-125~130 全完成 + 3 個 hotfix（reschedule purchase_id、cancel refund、group auto-confirm notify）已 push production
- **S5 brainstorm**：spec 完成、commit `2d827cd`、含 FR-131~136

### 🔜 S5 plan + 實作（明天 from-zero）

1. **複審 spec**（5 分鐘）：開 `docs/superpowers/specs/2026-05-26-s5-coach-page-and-auth-design.md`，看 §2 範圍 / §7 風險表 / §6 檔案異動清單 三段。OK 就跟 Claude 說「spec OK 出 plan」
2. **產 plan**：Claude 會 invoke writing-plans 自動產出 `docs/superpowers/plans/2026-05-27-s5-coach-page-and-auth.md`
3. **執行**：Subagent-Driven Development（與 S2~S4 同模式）

### 🧪 S4 殘留視覺驗收（你有空跑一輪 `npm run dev` 或在 production 直接看）

- `/packages` 教練後台建套裝、預設 / 已刪除分頁切換
- `/packages/pending` 看到小華 pending request、按確認
- `/[slug]/packages` 學員端瀏覽申請流程
- `/calendar` 5/30 那週的網球團體班 slot 上顯示「2/4」徽章、點 popover 看「已預約人數」
- 改期 / 取消 booking：確認 purchase.classes_used 有正確 +/-

## 接下來的 S 子專案順序

| 子專案 | 內容 | 狀態 |
|---|---|---|
| S1 | 緊急 bug triage | ✅ 完成 |
| S2 | 效能 + RWD | ✅ 完成 |
| S3 | 行事曆與可用性管理 | ✅ 完成 |
| S4 | 服務與商品模型擴充 | ✅ 完成 |
| **S5** | **教練介紹頁 + 學員登入流程** | **明天做** |
| S6 | 主題色 / 字型統一 + UI/UX + 架構 / 資安 review | 待 |

## S5 範圍速覽（給 Claude 看的）

6 個 FR：
- FR-131 wire 既有 avatar_url（hero cover）
- FR-132 tenant_photos + Supabase Storage bucket（≤ 10 張）
- FR-133 intro_video_url + YouTube/Vimeo embed
- FR-134 bio_html + TipTap 編輯器 + sanitize-html
- FR-135 signup 保留 `?redirect=` + auto-login
- FR-136 公開頁未登入時 hero CTA

新依賴：`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `sanitize-html`

## 重要原則（給 Claude 看的）

- 直接在 `master` 上工作（專案慣例）
- HEREDOC commit message + `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- Subagent-Driven flow：implementer (sonnet) → spec reviewer (sonnet) → code quality reviewer (sonnet)
- 完成後 push origin master 並等 Vercel READY 才算結束
- 文件更新 follow `memory/feedback_docs_after_impl.md`
- S5 Task list 比 S4 短（無 RPC 改造、無 backfill），估約 12~14 個 task
