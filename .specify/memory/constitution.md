<!--
Sync Impact Report:
- Version change: 1.0.0 → 1.1.0
- List of modified principles: All principles and sections translated to Traditional Chinese.
- Added sections: None
- Removed sections: None
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md
  - ✅ .specify/templates/tasks-template.md
- Follow-up TODOs: None
-->
# QuickReserve 專案章程

## 核心原則

### I. API 優先設計 (API-First Design)
所有核心功能都必須透過定義良好且文檔齊全的 RESTful API 來提供。使用 OpenAPI (Swagger) 定義的 API 合約，是所有客戶端與伺服器之間通訊的唯一真理來源。這確保了服務與消費者之間的明確分離，從而實現平行開發和獨立部署。

### II. 測試驅動開發 (Test-Driven Development, TDD)
所有新功能和錯誤修復都必須遵循嚴格的測試驅動開發（TDD）週期。在撰寫任何實作程式碼之前，必須先撰寫一個會失敗的測試來重現錯誤或定義新功能。只有當所有單元測試、整合測試和驗收測試都通過時，程式碼才被視為完成。

### III. 乾淨架構 (Clean Architecture)
系統將遵循乾淨架構的原則，在領域（Domain）、應用（Application）和基礎設施（Infrastructure）層之間保持嚴格的關注點分離。這確保了核心業務邏輯獨立於外部框架、資料庫和使用者介面，從而提高了可維護性、可測試性和靈活性。

### IV. 持續整合與持續部署 (CI/CD)
強制要求建立完全自動化的 CI/CD 管線。對主分支的每一次提交都必須觸發一個管線，該管線會自動建置、測試應用程式並將其部署到預備（staging）環境。生產環境的部署則受到自動化檢查的限制，並需要明確的批准，以確保快速可靠的發布節奏。

### V. 全方位可觀察性 (Comprehensive Observability)
系統必須從一開始就為可觀察性而設計。這包括所有服務的結構化日誌、全面的指標（例如：請求率、錯誤率、延遲）以及用於監控跨服務邊界請求的分散式追蹤。這對於理解系統健康狀況和在生產環境中診斷問題是不可協商的。

## 開發工作流程

開發過程遵循基於 GitFlow 的分支模型。所有工作都在功能分支（feature branches）上進行，然後合併到 `develop` 分支。拉取請求（Pull requests）需要至少一位同儕審查，並且所有自動化檢查（程式碼風格檢查、測試、漏洞掃描）都必須通過才能合併。

## 品質閘門 (Quality Gates)

任何程式碼在未通過所有品質閘門前都不能被合併。這包括新程式碼至少達到 80% 的測試覆蓋率、遵守靜態分析規則，以及成功完成 CI 管線。自動化掃描器發現的安全漏洞必須在部署前得到解決。

## 治理 (Governance)

本章程是 QuickReserve 專案的最高治理文件。所有開發實踐、架構決策和程式碼貢獻都必須遵守其原則。對本章程的任何修訂都需要一個正式的提案、團隊範圍的審查，以及針對現有程式碼庫的文檔化遷移計劃。

**版本**: 1.1.0 | **批准日期**: 2026-01-17 | **最後修訂**: 2026-01-17
