---
title: RLS Rewrite — Combine Multiple PERMISSIVE Policies
date: 2026-05-28
status: draft
parent_audit: docs/superpowers/specs/2026-05-28-supabase-advisors-snapshot.md
companion: docs/superpowers/specs/2026-05-28-s7-audit-report.md
risk: 中高 — RLS 改錯會 break 學員/教練讀寫
ship_strategy: A · 1 個大 migration 一次打(test 護身)
---

# RLS Rewrite — Combine Multiple PERMISSIVE Policies

## Context

Supabase advisor snapshot(2026-05-28)抓到 130 個 RLS-related perf lints:
- 120 × `multiple_permissive_policies` 跨 7 個 table
- 10 × `auth_rls_initplan` — `auth.uid()` 沒包 subselect,每 row 都重評估

成因:S3 / S5 era 寫 policy 時把 "member 看得到" 跟 "owner 看得到" 跟 "admin 看得到" 各寫一條,Postgres 同 action 多條 PERMISSIVE 會 UNION 評估,讀 query 路徑變慢。沒功能 bug,但 query plan 成本浪費。

修法 advisor 已給:**多條合一條 OR**,以及 `auth.uid()` 包 `(select ...)` 讓 Postgres plan-cache 一次。

## Goals

1. 把 7 個 table 受影響 policies 重寫,advisor `multiple_permissive_policies` 120 → 0,`auth_rls_initplan` 10 → 0
2. **Permission semantics 完全不變** — 用新 integration test matrix 護身
3. 一個 atomic migration apply,可預備 rollback file

## Non-goals

- Schema / column 改動(沒有)
- Application code 改動(沒有 — 純 DB-side rules)
- 14 個 `SECURITY DEFINER` RPC 的 caller-guard review(S7 audit 報告另列)
- Drop 10 unused indexes(advisor 另標,需要再觀察一週)
- 搬 `btree_gist` extension 出 public schema(cosmetic,獨立 small migration)
- 改 `notification_preferences` / `tenants` / `services` 等已乾淨的 table 的 policies

## Approach (chosen)

**Ship 策略 A:** 1 個 migration 一次重寫 7 個 table policies。優點是 atomic + 一次 advisor 數字降到 0;缺點是 blast radius 大,完全靠 test gate 防線。

**Test 策略 Y:** 寫新 `tests/integration/rls-rewrite-matrix.test.ts` 涵蓋 4 role × 7 table 的權限矩陣。**Migration 套用前**該 test 跑現況 RLS 全綠(baseline);**套用後** re-run 全綠才算 done。

**Policy 寫法:** 單一 OR'd policy(YAGNI;不抽 helper function;policy 字數略長但 SQL 自明、不增加抽象層)。

## Per-table changes

每個 table 的 policy 數量變化:

| Table | 原 policy 數 | 新 policy 數 | Action split |
|---|---|---|---|
| `availability_templates` | 5 | 4 | SELECT + INSERT + UPDATE + DELETE 各一(member OR owner OR admin) |
| `availability_template_windows` | 3 | 4 | 同上 |
| `availability_template_assignments` | 5 | 4 | 同上 |
| `unavailable_events` | 5 | 4 | 同上 |
| `customer_purchases` | 6 | 3 | SELECT(customer OR member OR admin)+ INSERT(member OR customer-with-locked-status)+ UPDATE(member) |
| `service_packages` | 6 | 4 | SELECT(public-active OR member OR admin)+ INSERT/UPDATE/DELETE(owner) |
| `tenant_photos` | 6 | 4 | SELECT(public-active OR member OR admin)+ INSERT/UPDATE/DELETE(owner) |

**`auth.uid()` wrap 點(5 處):**
- `availability_templates` member SELECT/modify
- `availability_template_windows` member modify(透過 nested EXISTS)
- `availability_template_assignments` member SELECT/modify
- `unavailable_events` member SELECT/modify
- `customer_purchases` customer SELECT + INSERT

**最關鍵的 corner case:** `customer_purchases_insert` 合一條,但 customer 跟 member 的 WITH CHECK 邏輯不同 — customer 必須鎖定 `approval_status='pending_review'` + `classes_used=0` + `approved_at IS NULL` + `approved_by IS NULL`。用 OR 接兩個 AND 子句:

```sql
create policy customer_purchases_insert on public.customer_purchases for insert
  with check (
    -- branch 1: tenant member (coach/staff) — open scope
    tenant_id in (select current_user_tenant_ids())
    OR
    -- branch 2: customer self-request — must be locked to pending
    (
      customer_id = (select auth.uid())
      AND approval_status = 'pending_review'
      AND classes_used = 0
      AND approved_at is null
      AND approved_by is null
    )
  );
```

Test gate 對這個 case 要特別驗:**customer INSERT with `approval_status='confirmed'` 必須被擋。**

## SQL templates

### Template A · availability series(4 tables,member OR owner OR admin)

```sql
drop policy if exists templates_select_member on public.availability_templates;
drop policy if exists templates_select_owner  on public.availability_templates;
drop policy if exists templates_select_admin  on public.availability_templates;
drop policy if exists templates_modify_member on public.availability_templates;
drop policy if exists templates_modify_owner  on public.availability_templates;

create policy templates_select on public.availability_templates for select to authenticated
  using (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy templates_insert on public.availability_templates for insert to authenticated
  with check (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy templates_update on public.availability_templates for update to authenticated
  using (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  )
  with check (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );

create policy templates_delete on public.availability_templates for delete to authenticated
  using (
    is_platform_admin()
    OR member_id in (
      select id from public.tenant_members
      where user_id = (select auth.uid()) and status = 'active'
    )
    OR member_id in (
      select id from public.tenant_members
      where tenant_id in (select current_user_owner_tenant_ids())
    )
  );
```

Same shape for `availability_template_assignments` 跟 `unavailable_events`(用 `member_id`)。**`availability_template_windows` 不同 — 它沒有自己的 `member_id`,要透過 parent template 的 ownership**:

```sql
-- For each of select/insert/update/delete on availability_template_windows:
create policy template_windows_<action> on public.availability_template_windows for <action> to authenticated
  using (
    is_platform_admin()
    OR template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where user_id = (select auth.uid()) and status = 'active'
      )
    )
    OR template_id in (
      select id from public.availability_templates
      where member_id in (
        select id from public.tenant_members
        where tenant_id in (select current_user_owner_tenant_ids())
      )
    )
  )
  with check ( /* same shape — only for insert/update */ );
```

### Template B · public-readable(`tenant_photos`、`service_packages`)

```sql
drop policy if exists service_packages_select_member on public.service_packages;
drop policy if exists service_packages_select_public on public.service_packages;
drop policy if exists service_packages_select_admin  on public.service_packages;

create policy service_packages_select on public.service_packages for select
  using (
    -- Public read of active packages of active tenants (anon + auth)
    (is_active = true and tenant_id in (select id from public.tenants where status = 'active'))
    OR
    -- Tenant member sees all packages including inactive
    tenant_id in (select current_user_tenant_ids())
    OR
    is_platform_admin()
  );

-- INSERT/UPDATE/DELETE 維持 owner-only 各自一條;原本就 single permissive,不變
```

Same for `tenant_photos`。

### Template C · `customer_purchases` 三條

```sql
drop policy if exists customer_purchases_select_customer on public.customer_purchases;
drop policy if exists customer_purchases_select_member   on public.customer_purchases;
drop policy if exists customer_purchases_select_admin    on public.customer_purchases;
drop policy if exists customer_purchases_insert_customer on public.customer_purchases;
drop policy if exists customer_purchases_insert_member   on public.customer_purchases;

create policy customer_purchases_select on public.customer_purchases for select to authenticated
  using (
    is_platform_admin()
    OR customer_id = (select auth.uid())
    OR tenant_id in (select current_user_tenant_ids())
  );

create policy customer_purchases_insert on public.customer_purchases for insert to authenticated
  with check (
    tenant_id in (select current_user_tenant_ids())
    OR (
      customer_id = (select auth.uid())
      AND approval_status = 'pending_review'
      AND classes_used = 0
      AND approved_at is null
      AND approved_by is null
    )
  );

-- existing customer_purchases_update_member (member-only) unchanged
```

## Test matrix

新檔 `tests/integration/rls-rewrite-matrix.test.ts`,~28 cases:

### Fixture(beforeAll · 用 service_role 預埋)
- 1 tenant `rls-test-tenant`(status='active')
- 1 owner auth.users + tenant_members row(role='owner', status='active')
- 1 staff auth.users + tenant_members row(role='staff', status='active', same tenant)
- 1 customer auth.users + customers row
- 1 service + 1 active service_package
- 1 customer_purchase(approval_status='pending_review', classes_used=0)
- 1 availability_template + 1 template_window + 1 template_assignment(belong to owner's member_id)
- 1 unavailable_event(belong to staff's member_id)
- 1 tenant_photo

### 4 role clients
- `ownerClient` — owner sign-in
- `staffClient` — staff sign-in
- `customerClient` — customer sign-in
- `anonClient` — `NEXT_PUBLIC_SUPABASE_ANON_KEY` no session
- (Platform admin paths use `service_role` directly — bypass test)

### Cases

**`availability_templates` (4):**
- ✅ Owner SELECT → 1 row
- ✅ Staff SELECT (owns staff's member_id) → 0 rows (fixture template belongs to owner, not staff)
- ❌ Customer SELECT → 0 rows
- ❌ Anon SELECT → 0 rows

**`availability_template_windows` (2):**
- ✅ Owner SELECT → 1 row
- ❌ Customer SELECT → 0 rows

**`availability_template_assignments` (2):**
- ✅ Owner SELECT → 1 row
- ❌ Customer SELECT → 0 rows

**`unavailable_events` (4):**
- ✅ Owner SELECT → 1 row (owner sees own tenant's events)
- ✅ Staff SELECT own member's event → 1 row
- ❌ Customer SELECT → 0 rows
- ❌ Anon SELECT → 0 rows

**`customer_purchases` (7):**
- ✅ Customer SELECT own → 1 row
- ❌ Customer SELECT another's purchase (insert one via service_role for a different customer first) → 0 rows
- ✅ Owner SELECT all in tenant → ≥1 row
- ✅ Customer INSERT own with `approval_status='pending_review'` → success
- ❌ Customer INSERT own with `approval_status='confirmed'` → blocked (WITH CHECK fails)
- ❌ Customer INSERT with `classes_used=5` → blocked
- ❌ Customer UPDATE own → blocked (only members can update)

**`service_packages` (5):**
- ✅ Anon SELECT active package of active tenant → 1 row
- ❌ Anon SELECT inactive package(預埋一個 is_active=false)→ 0 rows
- ❌ Anon SELECT package of suspended tenant(預埋一個)→ 0 rows
- ✅ Owner INSERT → success
- ❌ Customer INSERT → blocked

**`tenant_photos` (4):**
- ✅ Anon SELECT photo of active tenant → 1 row
- ❌ Anon SELECT photo of suspended tenant → 0 rows
- ✅ Owner DELETE own → success
- ❌ Customer DELETE owner's photo → blocked

**Total: 28 test cases.**

### Test 跑法

```bash
# baseline (before migration)
npm run test:integration -- tests/integration/rls-rewrite-matrix.test.ts
# Expected: 全綠 — 因為現況 RLS 雖然 multi-policy 但 semantics 對的

# after migration
npx supabase db push
npm run test:integration -- tests/integration/rls-rewrite-matrix.test.ts
# Expected: 全綠 — 任何 regression = migration 有 bug
```

## Rollback plan

**Rollback file:** `docs/superpowers/specs/2026-05-28-rls-rewrite-rollback.sql`(**不放在 migrations/ 因為不會 auto-apply**)。

內容:把新 4-policy / 3-policy 結構 DROP,把原始 5-policy / 6-policy 結構 RE-CREATE。如果 prod 出事:

```bash
# Emergency rollback
SUPABASE_ACCESS_TOKEN=<token> npx supabase db push  # 或 psql 直餵 rollback.sql
```

備援:`pg_dump --schema-only --section=post-data` 也可以匯出當下 policy 狀態,本地保存一份在跑 migration 前。

## Apply order

1. **Write test file** `tests/integration/rls-rewrite-matrix.test.ts` 含 28 cases
2. **Run test against current schema** → baseline 全綠(若有 bug 先修)
3. Commit test file 單獨一個 commit(`test(rls): add 28-case RLS matrix baseline before rewrite`)
4. **Write migration file** `supabase/migrations/<TS>_rls_rewrite_combine_permissive.sql`
5. **Write rollback file** `docs/superpowers/specs/2026-05-28-rls-rewrite-rollback.sql`
6. **Apply migration** via `npx supabase db push`
7. **Re-run test** → 全綠
8. **Re-run advisor** → confirm 120 + 10 lints 都 0
9. Commit migration + rollback file
10. Push to master
11. Vercel deploy(no-op for app code,只是 trigger e2e workflow)
12. GitHub Actions e2e 全綠 → done
13. Update advisor snapshot doc + TOMORROW.md

## Done criteria

**Migration & policies:**
- Migration applied successfully on linked Supabase
- Advisor `multiple_permissive_policies` 120 → 0
- Advisor `auth_rls_initplan` 10 → 0
- Per-table policy count matches per-table table above

**Tests:**
- New `rls-rewrite-matrix.test.ts` ~28 cases 全綠
- Existing 5 integration tests 全綠
- 105 unit tests 全綠
- 31 Playwright e2e 全綠(GitHub Actions 驗)
- `scripts/e2e-verify.mjs` 12 步 booking flow 跑得過

**Manual spot check:**
- `/coach-poyu` 公開頁能看到照片、服務、套裝
- 教練後台 `/calendar/availability` 模板 list 正確
- `/packages/pending` 看得到 customer purchases
- 學員 `/my-bookings` 看得到自己預約
- Owner / Staff 區隔正確

**Docs:**
- Advisor snapshot doc 標記 lints 已修
- TOMORROW.md 移除 RLS rewrite 項目

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| 合 OR 後語意改變(e.g. 不小心放寬權限) | 28-case test matrix 含 negative assertions(該擋的 case 必驗 0 rows / error) |
| `customer_purchases_insert` 兩條 OR 寫錯 → customer 能自己 confirm | 3 個專門 negative test:approval_status='confirmed' / classes_used>0 / 假 customer_id |
| Migration apply 中途失敗(部分 DROP 完但 CREATE 卡住) | Wrap migration in `begin; ... commit;`(Supabase migrations 預設就是 transactional) |
| Prod 出事但 rollback file 不在 git | Rollback file 跟 migration 同一個 commit |
| Performance regression(雖然目標是改善) | Re-run advisor 確認 advisor 數字 + e2e workflow 跑完整 booking flow |

## References

- `docs/superpowers/specs/2026-05-28-supabase-advisors-snapshot.md` — advisor 完整 lints 列表
- `docs/superpowers/specs/2026-05-28-s7-audit-report.md` — companion audit
- Existing RLS migrations:
  - `20260525100001_availability_templates_rls.sql`
  - `20260525100003_unavailable_events_rls.sql`
  - `20260525100004_template_windows_rls_explicit.sql`
  - `20260525200001_service_packages_rls.sql`
  - `20260525200003_customer_purchases_rls.sql`
  - `20260526100002_tenant_photos_rls.sql`
- Existing integration tests:
  - `tests/integration/rls-identity.test.ts`
  - `tests/integration/staff-isolation.test.ts`
- Supabase advisor remediation docs:
  - `https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies`
  - `https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan`
