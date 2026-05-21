# Plan 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the Next.js + Supabase + Vercel foundation with multi-tenant identity, RLS-enforced data isolation, authentication, route protection, and a working invite flow — ending with a deployed app where a platform admin can invite a coach who logs in to their own (empty) tenant dashboard.

**Architecture:** Next.js 15 App Router with React Server Components and Server Actions. Supabase PostgreSQL with Row Level Security as the source of truth for multi-tenant isolation. Supabase Auth for identity. `next-safe-action` wraps every mutation with Zod validation + auth context + error mapping. Middleware enforces route group access. Vercel deploys preview-per-PR and production from `master`.

**Tech Stack:**
- Next.js 15 (App Router, RSC, Server Actions)
- TypeScript (strict)
- Supabase (PostgreSQL + Auth + JS client)
- `next-safe-action` (Server Action wrapper)
- `zod` (input validation)
- Tailwind CSS + shadcn/ui
- ESLint + Prettier
- Vitest (unit tests)
- Vercel (hosting + cron)

**Spec reference:** [`docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md`](../specs/2026-05-21-quickreserve-redesign-design.md) — §3 (角色), §6.3 (路由), §7.2 (identity 部分 schema), §8 (安全), §11 (錯誤處理).

**Out of scope for Plan 1:** Services, AvailabilitySlots, Bookings, Recurring rules, Notifications, Platform admin dashboard UI (only the empty layout shell). These are deferred to Plans 2-7.

---

## File Map

Files created or modified in this plan:

**Configuration**
- `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `.eslintrc.json`, `.prettierrc`, `vitest.config.ts`
- `.env.local.example`, `.gitignore` (extend)
- `vercel.json`

**Supabase**
- `supabase/migrations/0001_identity_schema.sql`
- `supabase/migrations/0002_identity_rls.sql`
- `supabase/seed.sql`
- `supabase/config.toml`
- `src/lib/supabase/server.ts` — Server Component / Action client
- `src/lib/supabase/middleware.ts` — Edge middleware client
- `src/lib/supabase/types.ts` — generated DB types

**Core libraries**
- `src/lib/errors.ts` — AppError hierarchy
- `src/lib/safe-action.ts` — wrapper factory
- `src/lib/auth/get-session.ts` — session + role helpers
- `src/lib/auth/get-tenant-context.ts` — tenant context loader

**Middleware**
- `src/middleware.ts`

**Layouts & routes**
- `src/app/layout.tsx` — root
- `src/app/globals.css`
- `src/app/page.tsx` — landing
- `src/app/(auth)/layout.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/login/actions.ts`
- `src/app/(auth)/signup/page.tsx`
- `src/app/(auth)/signup/actions.ts`
- `src/app/(auth)/callback/route.ts` — auth code exchange
- `src/app/(platform)/layout.tsx`
- `src/app/(platform)/platform/dashboard/page.tsx` — empty shell
- `src/app/(platform)/platform/tenants/page.tsx` — list tenants
- `src/app/(platform)/platform/tenants/actions.ts` — invite coach action
- `src/app/(tenant)/layout.tsx`
- `src/app/(tenant)/dashboard/page.tsx` — empty shell
- `src/app/(tenant)/error.tsx`
- `src/app/(customer)/layout.tsx`
- `src/app/(customer)/error.tsx`
- `src/app/[tenantSlug]/page.tsx` — minimal public landing
- `src/app/error.tsx` — global error boundary
- `src/app/not-found.tsx`

**Invite flow**
- `src/app/invite/[token]/page.tsx` — invite accept page
- `src/app/invite/[token]/actions.ts`

**Tests**
- `tests/unit/safe-action.test.ts`
- `tests/unit/errors.test.ts`
- `tests/integration/rls-identity.test.ts`

**CI**
- `.github/workflows/ci.yml`

---

## Phase A — Project Initialization (Tasks 1-4)

### Task 1: Archive legacy code and scaffold Next.js project

**Files:**
- Create: `legacy/` (move existing folders here)
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore` (extend)
- Modify: project root

The current repo holds the old ASP.NET / Vue code. We keep it accessible but move it out of the way so the Next.js app can own the root.

- [ ] **Step 1: Move legacy code into `legacy/`**

Run from project root:

```powershell
New-Item -ItemType Directory -Path legacy -Force
Move-Item WebApi legacy/
Move-Item WebApi.Test legacy/
Move-Item WebApp legacy/
Move-Item QuickReserve.sln legacy/
```

Expected: `legacy/WebApi/`, `legacy/WebApi.Test/`, `legacy/WebApp/`, `legacy/QuickReserve.sln` exist; project root no longer has these.

- [ ] **Step 2: Initialize Next.js 15 with TypeScript**

Run from project root:

```bash
npx create-next-app@15 . --typescript --tailwind --app --eslint --src-dir --import-alias "@/*" --no-turbopack --use-npm
```

When prompted "Ok to proceed?" → yes. When prompted about existing files, allow overwrite of `.gitignore` (we'll restore custom entries in Step 4).

Expected: `src/app/`, `src/app/layout.tsx`, `src/app/page.tsx`, `next.config.ts`, `tailwind.config.ts`, `package.json` exist. Running `npm run dev` starts dev server on http://localhost:3000.

- [ ] **Step 3: Verify dev server works**

```bash
npm run dev
```

Visit http://localhost:3000. Expected: default Next.js welcome page. Then `Ctrl+C` to stop.

- [ ] **Step 4: Restore custom `.gitignore` entries**

Edit `.gitignore` (append at end):

```
# Gemini/Specify temp folders
.gemini/
.specify/

# Superpowers brainstorm session files (local only)
.superpowers/

# Claude Code local settings
.claude/

# Supabase local
supabase/.branches
supabase/.temp

# Legacy project artifacts
legacy/**/bin/
legacy/**/obj/
legacy/**/node_modules/
```

- [ ] **Step 5: Set strict TypeScript**

Edit `tsconfig.json` `compilerOptions` to include:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": false,
    "target": "ES2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "lib": ["dom", "dom.iterable", "es2022"],
    "jsx": "preserve",
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] },
    "forceConsistentCasingInFileNames": true,
    "noEmit": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "legacy"]
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(plan-1): scaffold Next.js 15 app, archive legacy code

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Add Prettier, lint rules, and Vitest

**Files:**
- Create: `.prettierrc`, `.prettierignore`, `vitest.config.ts`
- Modify: `package.json`, `.eslintrc.json` (or `eslint.config.mjs`)

- [ ] **Step 1: Install dev tools**

```bash
npm install -D prettier eslint-config-prettier vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Create `.prettierrc`**

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

- [ ] **Step 3: Create `.prettierignore`**

```
.next
node_modules
legacy
supabase/.branches
supabase/.temp
.superpowers
*.md
```

- [ ] **Step 4: Update `package.json` scripts**

In `package.json` `"scripts"`, add / replace:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "lint:fix": "next lint --fix",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: { reporter: ['text', 'html'] },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 6: Create `tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 7: Add Prettier-compatible ESLint config**

If `.eslintrc.json` exists, edit `"extends"` to include `"prettier"` last:

```json
{
  "extends": ["next/core-web-vitals", "next/typescript", "prettier"]
}
```

If `eslint.config.mjs` is used instead, append after the Next.js configs:

```js
import prettier from 'eslint-config-prettier'
export default [/* existing configs */, prettier]
```

- [ ] **Step 8: Verify everything runs**

```bash
npm run format
npm run lint
npm run typecheck
npm run test
```

Expected: all four exit with code 0 (`test` reports "No test files found" — that's fine).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore(plan-1): add Prettier, Vitest, format scripts

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Install Supabase + shadcn/ui + next-safe-action

**Files:**
- Modify: `package.json`
- Create: `src/lib/utils.ts` (shadcn util), `components.json` (shadcn config)

- [ ] **Step 1: Install runtime deps**

```bash
npm install @supabase/supabase-js @supabase/ssr zod next-safe-action pino
```

- [ ] **Step 2: Initialize shadcn/ui**

```bash
npx shadcn@latest init -d
```

When prompted:
- Style: New York
- Base color: Slate
- CSS variables: Yes

Expected: `components.json`, `src/lib/utils.ts` created, `src/app/globals.css` updated with CSS variables.

- [ ] **Step 3: Install initial shadcn components**

```bash
npx shadcn@latest add button input label card form alert toast sonner --yes
```

Expected: `src/components/ui/button.tsx`, `input.tsx`, `label.tsx`, `card.tsx`, `form.tsx`, `alert.tsx`, `toast.tsx`, `sonner.tsx` created.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: build succeeds (may have warnings about no pages — that's fine).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(plan-1): install Supabase, shadcn/ui, next-safe-action, zod

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Wire Vercel env vars and trigger first preview deploy

**Files:**
- Create: `.env.local.example`, `.env.local`

- [ ] **Step 1: Create `.env.local.example` (committed, no secrets)**

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
SUPABASE_PROJECT_REF=YOUR_PROJECT_REF

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cron
CRON_SECRET=local-dev-only-replace-in-vercel

# Logging
LOG_LEVEL=info
```

- [ ] **Step 2: Create local `.env.local` with real values**

Tell the human: copy `.env.local.example` to `.env.local` and fill in the actual values from Supabase Dashboard → Project Settings → API. Generate `CRON_SECRET` locally with `openssl rand -hex 32` or any random 64-char string. `.env.local` is git-ignored so this stays out of the repo.

- [ ] **Step 3: Set environment variables in Vercel**

In Vercel Project → Settings → Environment Variables, add the same set for all three environments (Production, Preview, Development):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase Dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase Dashboard (publishable) |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase Dashboard (secret) — mark as **Sensitive** |
| `SUPABASE_PROJECT_REF` | from Supabase URL (the subdomain part) |
| `NEXT_PUBLIC_APP_URL` | `https://YOUR_VERCEL_DOMAIN` (Production); `$VERCEL_URL` won't work in `NEXT_PUBLIC_*` — use the production URL |
| `CRON_SECRET` | new random 64-char string — mark as **Sensitive** |
| `LOG_LEVEL` | `info` |

- [ ] **Step 4: Trigger a deploy and verify**

```bash
git push origin master
```

Watch Vercel deploy in https://vercel.com/terry31415926s-projects/quick-reserve. Expected: deploy succeeds; visiting the production URL shows Next.js default page.

- [ ] **Step 5: Commit `.env.local.example`**

```bash
git add .env.local.example .gitignore
git commit -m "chore(plan-1): add .env.local.example with required vars

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin master
```

---

## Phase B — Supabase Connection (Tasks 5-8)

### Task 5: Install Supabase CLI and link project

**Files:**
- Create: `supabase/config.toml` (auto-generated)
- Modify: `package.json`

- [ ] **Step 1: Install Supabase CLI as dev dependency**

```bash
npm install -D supabase
```

This installs `supabase` as a local binary (avoids global install).

- [ ] **Step 2: Initialize Supabase folder**

```bash
npx supabase init
```

When prompted for VSCode/IntelliJ settings → No. Expected: `supabase/config.toml` created.

- [ ] **Step 3: Link to cloud project**

```bash
npx supabase link --project-ref buiefmgwzxpuxfshixas
```

When prompted for database password, enter the one stored in your password manager (the user rotated it after sharing earlier). Expected: "Finished `supabase link`".

- [ ] **Step 4: Add `db` scripts to `package.json`**

In `"scripts"`:

```json
"db:push": "supabase db push",
"db:diff": "supabase db diff",
"db:reset": "supabase db reset --linked",
"db:types": "supabase gen types typescript --linked > src/lib/supabase/types.ts"
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(plan-1): link Supabase project, add db scripts

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Create Supabase client helpers

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`, `src/lib/supabase/types.ts` (placeholder)

We need three clients: a Server Component / Action client (reads cookies via `next/headers`), a middleware client (reads/writes cookies via `NextResponse`), and an admin client (uses service_role key, server-only).

- [ ] **Step 1: Create placeholder `src/lib/supabase/types.ts`**

```ts
// This file is regenerated by `npm run db:types` after schema migrations apply.
// Placeholder until first migration is applied.
export type Database = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
```

- [ ] **Step 2: Create `src/lib/supabase/server.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component — Next.js forbids cookie writes here.
          // Cookie refresh will happen during the next Server Action or route handler.
        }
      },
    },
  })
}

export function createSupabaseAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createServerClient<Database>(url, serviceKey, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
```

- [ ] **Step 3: Create `src/lib/supabase/middleware.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { Database } from './types'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // Touch the session so the token gets refreshed if needed.
  const { data: { user } } = await supabase.auth.getUser()

  return { response, user }
}
```

- [ ] **Step 4: Run typecheck to verify**

```bash
npm run typecheck
```

Expected: passes with no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(plan-1): add Supabase client helpers (server, admin, middleware)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Create initial migration — identity schema

**Files:**
- Create: `supabase/migrations/0001_identity_schema.sql`

This migration creates the 5 identity tables: `tenants`, `tenant_members`, `platform_admins`, `customers`, `tenant_customers`. **No RLS yet** — that's a separate migration (Task 8) so each is auditable.

- [ ] **Step 1: Create migration file**

Run:

```bash
npx supabase migration new identity_schema
```

This creates `supabase/migrations/<timestamp>_identity_schema.sql`. Edit that file's contents:

```sql
-- 0001 identity schema
-- Multi-tenant identity tables: tenants, tenant_members, platform_admins, customers, tenant_customers
-- RLS policies are applied in 0002_identity_rls.sql.

create extension if not exists "pgcrypto";

-- tenants: each coach is a tenant
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  avatar_url text,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_tenants_slug on public.tenants(slug);

-- tenant_members: Owner + Staff within a tenant
create table public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  parent_member_id uuid references public.tenant_members(id),
  status text not null default 'active' check (status in ('active', 'invited', 'removed')),
  invited_email text,
  invite_token text unique,
  invite_expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index idx_tenant_members_user on public.tenant_members(user_id);
create index idx_tenant_members_tenant on public.tenant_members(tenant_id);
create index idx_tenant_members_invite_token on public.tenant_members(invite_token) where invite_token is not null;

-- platform_admins: platform-level operators
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- customers: end users (students) who book
create table public.customers (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  created_at timestamptz not null default now()
);

-- tenant_customers: bridge for cross-tenant isolation
create table public.tenant_customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  tenant_notes text,
  created_at timestamptz not null default now(),
  unique (tenant_id, customer_id)
);

-- Helper: updated_at trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: Push migration to cloud Supabase**

```bash
npm run db:push
```

When prompted "Do you want to push these migrations?" → yes.

Expected: "Finished supabase db push" with confirmation each table created.

- [ ] **Step 3: Regenerate TypeScript types**

```bash
npm run db:types
```

Expected: `src/lib/supabase/types.ts` is overwritten with full schema types.

- [ ] **Step 4: Verify in Supabase Dashboard**

Open Supabase Dashboard → Table Editor. Confirm tables exist: `tenants`, `tenant_members`, `platform_admins`, `customers`, `tenant_customers`.

- [ ] **Step 5: Run typecheck (catches type drift)**

```bash
npm run typecheck
```

Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(plan-1): add identity schema migration (tenants, members, customers)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Apply RLS policies to identity tables

**Files:**
- Create: `supabase/migrations/0002_identity_rls.sql`

RLS is **off by default** in Postgres. We turn it on per table and write the policies.

- [ ] **Step 1: Create RLS migration**

```bash
npx supabase migration new identity_rls
```

Edit the new migration file:

```sql
-- 0002 identity RLS
-- Enable Row Level Security on all identity tables and apply isolation policies.

-- Helper: is the calling user a platform admin?
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

-- Helper: does the calling user belong to a tenant (any role, active)?
create or replace function public.current_user_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.tenant_members
  where user_id = auth.uid() and status = 'active';
$$;

-- ============ tenants ============
alter table public.tenants enable row level security;

create policy tenants_select_member on public.tenants
  for select using (
    is_platform_admin()
    or id in (select current_user_tenant_ids())
    or status = 'active'  -- public tenant page allowed when active
  );

create policy tenants_insert_admin on public.tenants
  for insert with check (is_platform_admin());

create policy tenants_update_admin_or_owner on public.tenants
  for update using (
    is_platform_admin()
    or id in (
      select tenant_id from public.tenant_members
      where user_id = auth.uid() and role = 'owner' and status = 'active'
    )
  );

-- ============ tenant_members ============
alter table public.tenant_members enable row level security;

-- Self can always read own row (needed for the helper functions to bootstrap)
create policy tenant_members_select_self on public.tenant_members
  for select using (user_id = auth.uid());

-- Owners see all members of their tenant
create policy tenant_members_select_owner on public.tenant_members
  for select using (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = auth.uid() and role = 'owner' and status = 'active'
    )
  );

create policy tenant_members_select_admin on public.tenant_members
  for select using (is_platform_admin());

-- Only owners can invite (insert) staff into their own tenant
create policy tenant_members_insert_owner on public.tenant_members
  for insert with check (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = auth.uid() and role = 'owner' and status = 'active'
    )
    and role = 'staff'
  );

-- Platform admin can insert any role (used by invite-coach flow)
create policy tenant_members_insert_admin on public.tenant_members
  for insert with check (is_platform_admin());

-- Self can update own row (used when accepting invitation)
create policy tenant_members_update_self on public.tenant_members
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy tenant_members_update_owner on public.tenant_members
  for update using (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = auth.uid() and role = 'owner' and status = 'active'
    )
  );

-- ============ platform_admins ============
alter table public.platform_admins enable row level security;

create policy platform_admins_select_self on public.platform_admins
  for select using (user_id = auth.uid() or is_platform_admin());

-- Inserts/updates/deletes only via service_role (no policy = no client write)

-- ============ customers ============
alter table public.customers enable row level security;

create policy customers_select_self on public.customers
  for select using (id = auth.uid());

create policy customers_select_tenant_member on public.customers
  for select using (
    id in (
      select customer_id from public.tenant_customers
      where tenant_id in (select current_user_tenant_ids())
    )
  );

create policy customers_select_admin on public.customers
  for select using (is_platform_admin());

create policy customers_upsert_self on public.customers
  for insert with check (id = auth.uid());

create policy customers_update_self on public.customers
  for update using (id = auth.uid());

-- ============ tenant_customers ============
alter table public.tenant_customers enable row level security;

create policy tenant_customers_select_member on public.tenant_customers
  for select using (
    tenant_id in (select current_user_tenant_ids())
    or customer_id = auth.uid()
    or is_platform_admin()
  );

create policy tenant_customers_insert_member on public.tenant_customers
  for insert with check (
    tenant_id in (select current_user_tenant_ids())
    or customer_id = auth.uid()
  );

create policy tenant_customers_update_member on public.tenant_customers
  for update using (
    tenant_id in (select current_user_tenant_ids())
    or is_platform_admin()
  );
```

- [ ] **Step 2: Push to cloud**

```bash
npm run db:push
```

Expected: "Finished supabase db push", no errors.

- [ ] **Step 3: Verify RLS is on**

In Supabase Dashboard → Database → Tables, each of the 5 identity tables should show "RLS enabled" badge. If any are missing, re-check the migration ran (Database → Migrations tab).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(plan-1): enable RLS on identity tables with isolation policies

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase C — Error Handling + Server Action Wrapper (Tasks 9-11)

### Task 9: AppError hierarchy with tests

**Files:**
- Create: `src/lib/errors.ts`, `tests/unit/errors.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  AppError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  SlotConflictError,
  SlotUnavailableError,
  ValidationError,
} from '@/lib/errors'

describe('AppError', () => {
  it('is an Error subclass with code and message', () => {
    const err = new AppError('SOME_CODE', 'human message')
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('SOME_CODE')
    expect(err.message).toBe('human message')
    expect(err.name).toBe('AppError')
  })

  it('ForbiddenError has FORBIDDEN code', () => {
    expect(new ForbiddenError().code).toBe('FORBIDDEN')
  })

  it('NotFoundError takes a resource name', () => {
    const err = new NotFoundError('booking')
    expect(err.code).toBe('NOT_FOUND')
    expect(err.message).toContain('booking')
  })

  it('RateLimitError code', () => {
    expect(new RateLimitError().code).toBe('RATE_LIMIT')
  })

  it('ValidationError carries field details', () => {
    const err = new ValidationError({ fieldErrors: { email: ['required'] } })
    expect(err.code).toBe('VALIDATION')
    expect(err.details).toEqual({ fieldErrors: { email: ['required'] } })
  })

  it('SlotConflictError carries conflicts array', () => {
    const conflicts = [{ id: 'a', startAt: '2026-05-21T14:00:00Z' }]
    const err = new SlotConflictError(conflicts)
    expect(err.code).toBe('SLOT_CONFLICT')
    expect(err.conflicts).toBe(conflicts)
  })

  it('SlotUnavailableError code', () => {
    expect(new SlotUnavailableError().code).toBe('SLOT_UNAVAILABLE')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test
```

Expected: FAIL — module `@/lib/errors` not found.

- [ ] **Step 3: Implement `src/lib/errors.ts`**

```ts
export class AppError extends Error {
  public readonly code: string
  public readonly details?: unknown

  constructor(code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.details = details
  }
}

export class ForbiddenError extends AppError {
  constructor(message = '無權限執行此操作') {
    super('FORBIDDEN', message)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} 不存在`)
    this.name = 'NotFoundError'
  }
}

export class RateLimitError extends AppError {
  constructor(message = '請稍後再試') {
    super('RATE_LIMIT', message)
    this.name = 'RateLimitError'
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown, message = '輸入格式錯誤') {
    super('VALIDATION', message, details)
    this.name = 'ValidationError'
  }
}

export type ConflictSlot = {
  id: string
  startAt: string
  endAt?: string
  serviceName?: string
  hasBooking?: boolean
  bookingId?: string | null
}

export class SlotConflictError extends AppError {
  public readonly conflicts: ConflictSlot[]

  constructor(conflicts: ConflictSlot[], message = '時段衝突') {
    super('SLOT_CONFLICT', message, conflicts)
    this.name = 'SlotConflictError'
    this.conflicts = conflicts
  }
}

export class SlotUnavailableError extends AppError {
  constructor(message = '該時段已被預約') {
    super('SLOT_UNAVAILABLE', message)
    this.name = 'SlotUnavailableError'
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test
```

Expected: PASS — 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(plan-1): add AppError hierarchy for typed business errors

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 10: `safeAction` wrapper using `next-safe-action`

**Files:**
- Create: `src/lib/safe-action.ts`, `tests/unit/safe-action.test.ts`

`next-safe-action` provides the foundation. We extend it with our error mapping and an action context (user + tenant + role).

- [ ] **Step 1: Write failing test**

Create `tests/unit/safe-action.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

// Mock the auth context loader before importing
vi.mock('@/lib/auth/get-session', () => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/auth/get-tenant-context', () => ({
  getTenantContext: vi.fn(),
}))

const { actionClient } = await import('@/lib/safe-action')
const { ForbiddenError, ValidationError } = await import('@/lib/errors')

describe('safeAction', () => {
  it('validates input with Zod and returns ok on success', async () => {
    const action = actionClient
      .inputSchema(z.object({ name: z.string().min(1) }))
      .action(async ({ parsedInput }) => {
        return { greeting: `hi ${parsedInput.name}` }
      })

    const result = await action({ name: 'wang' })
    expect(result?.data).toEqual({ greeting: 'hi wang' })
  })

  it('returns serverError shape on AppError', async () => {
    const action = actionClient.action(async () => {
      throw new ForbiddenError()
    })
    const result = await action()
    expect(result?.serverError).toMatchObject({ code: 'FORBIDDEN' })
  })

  it('returns validationErrors when zod parse fails', async () => {
    const action = actionClient
      .inputSchema(z.object({ name: z.string().min(1) }))
      .action(async () => ({ ok: true }))

    const result = await action({ name: '' })
    expect(result?.validationErrors).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test
```

Expected: FAIL — module `@/lib/safe-action` not found.

- [ ] **Step 3: Create `src/lib/safe-action.ts`**

```ts
import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from 'next-safe-action'
import { z } from 'zod'
import { AppError } from '@/lib/errors'

const baseClient = createSafeActionClient({
  defineMetadataSchema() {
    return z.object({
      actionName: z.string().optional(),
    })
  },
  handleServerError(error) {
    if (error instanceof AppError) {
      return {
        code: error.code,
        message: error.message,
        details: error.details ?? null,
      }
    }
    // Unknown error: log full server-side, return generic to client
    console.error('[safe-action] unhandled', error)
    return {
      code: 'INTERNAL_ERROR',
      message: DEFAULT_SERVER_ERROR_MESSAGE,
      details: null,
    }
  },
})

export const actionClient = baseClient
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test
```

Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(plan-1): add safeAction wrapper with AppError mapping

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 11: Auth context helpers

**Files:**
- Create: `src/lib/auth/get-session.ts`, `src/lib/auth/get-tenant-context.ts`

- [ ] **Step 1: Create `src/lib/auth/get-session.ts`**

```ts
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ForbiddenError } from '@/lib/errors'

export type AppUserRole = 'platform_admin' | 'tenant_owner' | 'tenant_staff' | 'customer' | 'anonymous'

export type Session = {
  userId: string
  email: string | null
  role: AppUserRole
  tenantId: string | null
  memberId: string | null
}

/**
 * Returns the calling user's session and resolved role.
 * Returns null for anonymous (unauthenticated) callers.
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Look up role - check platform_admin first, then tenant_member, else customer
  const [{ data: adminRow }, { data: memberRow }] = await Promise.all([
    supabase.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('tenant_members')
      .select('id, tenant_id, role, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
  ])

  let role: AppUserRole = 'customer'
  let tenantId: string | null = null
  let memberId: string | null = null

  if (adminRow) {
    role = 'platform_admin'
  } else if (memberRow) {
    role = memberRow.role === 'owner' ? 'tenant_owner' : 'tenant_staff'
    tenantId = memberRow.tenant_id
    memberId = memberRow.id
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role,
    tenantId,
    memberId,
  }
}

export async function requireSession(): Promise<Session> {
  const s = await getSession()
  if (!s) throw new ForbiddenError('未登入')
  return s
}

export async function requirePlatformAdmin(): Promise<Session> {
  const s = await requireSession()
  if (s.role !== 'platform_admin') throw new ForbiddenError('需平台管理員權限')
  return s
}

export async function requireTenantMember(): Promise<Session & { tenantId: string; memberId: string }> {
  const s = await requireSession()
  if (s.role !== 'tenant_owner' && s.role !== 'tenant_staff') throw new ForbiddenError('需教練/助教身分')
  if (!s.tenantId || !s.memberId) throw new ForbiddenError('租戶資訊缺失')
  return s as Session & { tenantId: string; memberId: string }
}

export async function requireTenantOwner(): Promise<Session & { tenantId: string; memberId: string }> {
  const s = await requireTenantMember()
  if (s.role !== 'tenant_owner') throw new ForbiddenError('需 Owner 身分')
  return s
}
```

- [ ] **Step 2: Create `src/lib/auth/get-tenant-context.ts`**

```ts
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NotFoundError } from '@/lib/errors'

export type TenantContext = {
  id: string
  slug: string
  name: string
  status: 'active' | 'suspended'
}

export async function getTenantContext(tenantId: string): Promise<TenantContext> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('tenants')
    .select('id, slug, name, status')
    .eq('id', tenantId)
    .single()
  if (error || !data) throw new NotFoundError('租戶')
  return data as TenantContext
}

export async function getTenantBySlug(slug: string): Promise<TenantContext | null> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('tenants')
    .select('id, slug, name, status')
    .eq('slug', slug)
    .maybeSingle()
  return (data as TenantContext) ?? null
}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(plan-1): add session/tenant context helpers with role checks

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase D — Middleware + Layouts (Tasks 12-14)

### Task 12: Implement edge middleware route guards

**Files:**
- Create: `src/middleware.ts`

Middleware runs at the edge before every matched request, refreshing the Supabase session and gating access to route groups.

- [ ] **Step 1: Create `src/middleware.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PUBLIC_PATHS = ['/', '/login', '/signup', '/callback', '/api/health']
const AUTH_PATHS = ['/login', '/signup']

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  // Bypass static & assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$/)
  ) {
    return response
  }

  const isAuthRoute = AUTH_PATHS.some((p) => pathname.startsWith(p))
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))

  // Already logged in users hitting login/signup → redirect to root (resolver picks dashboard)
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Anonymous user hitting a protected route → login
  const isProtected =
    pathname.startsWith('/platform') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/calendar') ||
    pathname.startsWith('/bookings') ||
    pathname.startsWith('/services') ||
    pathname.startsWith('/staff') ||
    pathname.startsWith('/customers') ||
    pathname.startsWith('/my-bookings') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/invite')

  if (!user && isProtected && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!api/cron|_next/static|_next/image).*)'],
}
```

- [ ] **Step 2: Run dev server and verify**

```bash
npm run dev
```

Visit:
- http://localhost:3000 → default page loads
- http://localhost:3000/platform/dashboard → redirects to `/login?redirect=/platform/dashboard`
- http://localhost:3000/dashboard → redirects to `/login?redirect=/dashboard`

Stop dev server (`Ctrl+C`).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(plan-1): add edge middleware for route group auth guards

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 13: Build login + signup pages with Server Actions

**Files:**
- Modify: `src/app/layout.tsx` (add Sonner toaster)
- Create: `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/login/actions.ts`, `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/signup/actions.ts`, `src/app/(auth)/callback/route.ts`

- [ ] **Step 1: Add Toaster to root layout**

Modify `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'QuickReserve',
  description: '預約系統 SaaS 平台',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Create `src/app/(auth)/layout.tsx`**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">{children}</div>
    </main>
  )
}
```

- [ ] **Step 3: Create `src/app/(auth)/login/actions.ts`**

```ts
'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { actionClient } from '@/lib/safe-action'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'

const LoginSchema = z.object({
  email: z.string().email('Email 格式不正確'),
  password: z.string().min(6, '密碼至少 6 個字'),
  redirectTo: z.string().optional(),
})

export const loginAction = actionClient
  .inputSchema(LoginSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: parsedInput.email,
      password: parsedInput.password,
    })
    if (error) throw new AppError('AUTH_FAILED', '帳號或密碼錯誤')
    redirect(parsedInput.redirectTo || '/')
  })
```

- [ ] **Step 4: Create `src/app/(auth)/login/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { loginAction } from './actions'

export default function LoginPage() {
  const params = useSearchParams()
  const redirectTo = params.get('redirect') ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const { execute, isPending } = useAction(loginAction, {
    onError: ({ error }) => {
      toast.error(error.serverError?.message ?? '登入失敗')
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>登入 QuickReserve</CardTitle>
      </CardHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          execute({ email, password, redirectTo })
        }}
      >
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密碼</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Link href="/signup" className="text-sm text-blue-600 hover:underline">
            還沒有帳號？
          </Link>
          <Button type="submit" disabled={isPending}>
            {isPending ? '登入中...' : '登入'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
```

- [ ] **Step 5: Create `src/app/(auth)/signup/actions.ts`**

```ts
'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { actionClient } from '@/lib/safe-action'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'

const SignupSchema = z.object({
  email: z.string().email('Email 格式不正確'),
  password: z.string().min(8, '密碼至少 8 個字'),
  displayName: z.string().min(1, '請輸入姓名').max(50),
})

export const signupAction = actionClient
  .inputSchema(SignupSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseServerClient()
    const { error, data } = await supabase.auth.signUp({
      email: parsedInput.email,
      password: parsedInput.password,
      options: {
        data: { display_name: parsedInput.displayName },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/callback`,
      },
    })
    if (error) throw new AppError('SIGNUP_FAILED', error.message)
    if (!data.user) throw new AppError('SIGNUP_FAILED', '註冊失敗')

    // Create customer profile (idempotent via on-conflict)
    await supabase.from('customers').upsert({
      id: data.user.id,
      display_name: parsedInput.displayName,
    })

    redirect('/login?signedup=1')
  })
```

- [ ] **Step 6: Create `src/app/(auth)/signup/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { signupAction } from './actions'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')

  const { execute, isPending } = useAction(signupAction, {
    onError: ({ error }) => {
      toast.error(error.serverError?.message ?? '註冊失敗')
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>建立帳號</CardTitle>
      </CardHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          execute({ email, password, displayName })
        }}
      >
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">姓名</Label>
            <Input
              id="displayName"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密碼</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Link href="/login" className="text-sm text-blue-600 hover:underline">
            已有帳號？登入
          </Link>
          <Button type="submit" disabled={isPending}>
            {isPending ? '建立中...' : '註冊'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
```

- [ ] **Step 7: Create `src/app/(auth)/callback/route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
```

- [ ] **Step 8: Run dev and try signup**

```bash
npm run dev
```

1. Visit http://localhost:3000/signup → fill in form → submit
2. Check Supabase Dashboard → Authentication → Users — new user should appear
3. Check `customers` table — row with the new user_id should exist
4. Go to `/login` and log in → redirects to `/`

Stop with `Ctrl+C`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(plan-1): login + signup pages with Supabase Auth

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 14: Build layout shells + error boundaries

**Files:**
- Create: `src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/page.tsx` (replace)
- Create: `src/app/(platform)/layout.tsx`, `src/app/(platform)/platform/dashboard/page.tsx`, `src/app/(platform)/platform/tenants/page.tsx`
- Create: `src/app/(tenant)/layout.tsx`, `src/app/(tenant)/dashboard/page.tsx`, `src/app/(tenant)/error.tsx`
- Create: `src/app/(customer)/layout.tsx`, `src/app/(customer)/error.tsx`
- Create: `src/app/[tenantSlug]/page.tsx`

- [ ] **Step 1: Replace `src/app/page.tsx` with role-aware landing**

```tsx
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/get-session'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function HomePage() {
  const session = await getSession()
  if (session) {
    if (session.role === 'platform_admin') redirect('/platform/dashboard')
    if (session.role === 'tenant_owner' || session.role === 'tenant_staff') redirect('/dashboard')
    if (session.role === 'customer') redirect('/my-bookings')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">QuickReserve</h1>
      <p className="text-slate-600">預約系統 SaaS 平台</p>
      <div className="flex gap-4">
        <Button asChild>
          <Link href="/login">登入</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/signup">註冊</Link>
        </Button>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Create global `src/app/error.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global-error]', error)
  }, [error])

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h2 className="text-2xl font-bold">發生錯誤</h2>
        <p className="mt-2 text-slate-600">{error.message || '系統錯誤，請稍後再試'}</p>
        <Button className="mt-6" onClick={reset}>
          重試
        </Button>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Create `src/app/not-found.tsx`**

```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold">頁面不存在</h2>
        <Button className="mt-6" asChild>
          <Link href="/">回首頁</Link>
        </Button>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Create `src/app/(platform)/layout.tsx`**

```tsx
import { requirePlatformAdmin } from '@/lib/auth/get-session'
import Link from 'next/link'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin()
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-slate-900 p-4 text-slate-100">
        <h2 className="mb-6 text-lg font-bold">平台後台</h2>
        <nav className="flex flex-col gap-2 text-sm">
          <Link href="/platform/dashboard">儀表板</Link>
          <Link href="/platform/tenants">租戶管理</Link>
        </nav>
      </aside>
      <main className="flex-1 bg-slate-50 p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 5: Create `src/app/(platform)/platform/dashboard/page.tsx`**

```tsx
export default function PlatformDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold">平台儀表板</h1>
      <p className="mt-2 text-slate-600">內容待 Plan 7 實作</p>
    </div>
  )
}
```

- [ ] **Step 6: Create `src/app/(platform)/platform/tenants/page.tsx`**

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function TenantsListPage() {
  const supabase = await createSupabaseServerClient()
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, slug, name, status, created_at')
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="text-2xl font-bold">租戶管理</h1>
      <table className="mt-6 w-full bg-white">
        <thead>
          <tr className="border-b text-left text-sm text-slate-600">
            <th className="p-3">Slug</th>
            <th className="p-3">名稱</th>
            <th className="p-3">狀態</th>
            <th className="p-3">建立日期</th>
          </tr>
        </thead>
        <tbody>
          {tenants?.map((t) => (
            <tr key={t.id} className="border-b text-sm">
              <td className="p-3">{t.slug}</td>
              <td className="p-3">{t.name}</td>
              <td className="p-3">{t.status}</td>
              <td className="p-3">{new Date(t.created_at).toLocaleDateString('zh-TW')}</td>
            </tr>
          ))}
          {!tenants?.length && (
            <tr>
              <td colSpan={4} className="p-6 text-center text-slate-400">
                尚無租戶
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 7: Create `src/app/(tenant)/layout.tsx`**

```tsx
import { requireTenantMember } from '@/lib/auth/get-session'
import { getTenantContext } from '@/lib/auth/get-tenant-context'
import Link from 'next/link'

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const session = await requireTenantMember()
  const tenant = await getTenantContext(session.tenantId)

  if (tenant.status === 'suspended') {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h2 className="text-2xl font-bold">您的租戶已被暫停</h2>
          <p className="mt-2 text-slate-600">請聯絡平台管理員。</p>
        </div>
      </main>
    )
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-slate-800 p-4 text-slate-100">
        <h2 className="mb-1 text-lg font-bold">{tenant.name}</h2>
        <p className="mb-6 text-xs opacity-70">{session.role === 'tenant_owner' ? 'Owner' : 'Staff'}</p>
        <nav className="flex flex-col gap-2 text-sm">
          <Link href="/dashboard">儀表板</Link>
          <Link href="/calendar">行事曆</Link>
          <Link href="/bookings">預約管理</Link>
          <Link href="/services">服務項目</Link>
          {session.role === 'tenant_owner' && <Link href="/staff">助教管理</Link>}
        </nav>
      </aside>
      <main className="flex-1 bg-slate-50 p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 8: Create `src/app/(tenant)/dashboard/page.tsx`**

```tsx
export default function TenantDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold">儀表板</h1>
      <p className="mt-2 text-slate-600">行事曆、預約管理等功能將在 Plan 2-3 實作</p>
    </div>
  )
}
```

- [ ] **Step 9: Create `src/app/(tenant)/error.tsx`**

```tsx
'use client'

import { Button } from '@/components/ui/button'

export default function TenantError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold">教練後台載入失敗</h2>
      <p className="mt-2 text-slate-600">{error.message}</p>
      <Button className="mt-4" onClick={reset}>
        重試
      </Button>
    </div>
  )
}
```

- [ ] **Step 10: Create `src/app/(customer)/layout.tsx`**

```tsx
import { requireSession } from '@/lib/auth/get-session'

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  await requireSession()
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl">{children}</div>
    </main>
  )
}
```

- [ ] **Step 11: Create `src/app/(customer)/error.tsx`**

```tsx
'use client'

import { Button } from '@/components/ui/button'

export default function CustomerError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold">載入失敗</h2>
      <p className="mt-2 text-slate-600">{error.message}</p>
      <Button className="mt-4" onClick={reset}>
        重試
      </Button>
    </div>
  )
}
```

- [ ] **Step 12: Create minimal `src/app/[tenantSlug]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { getTenantBySlug } from '@/lib/auth/get-tenant-context'

export default async function TenantPublicPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const tenant = await getTenantBySlug(tenantSlug)
  if (!tenant) notFound()

  if (tenant.status === 'suspended') {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-slate-600">此教練的預約服務暫停中</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-3xl font-bold">{tenant.name}</h1>
      <p className="mt-2 text-slate-600">{/* description */}</p>
      <p className="mt-8 text-slate-400">服務 / 預約 UI 將在 Plan 4 實作</p>
    </main>
  )
}
```

- [ ] **Step 13: Build + run + smoke test**

```bash
npm run build
```

Expected: build succeeds, all routes listed.

```bash
npm run dev
```

Smoke test (anonymous):
- `/` → landing
- `/login` → form
- `/signup` → form
- `/platform/dashboard` → redirects to `/login?redirect=/platform/dashboard`
- `/dashboard` → redirects to `/login?redirect=/dashboard`
- `/anyslug` → "tenant 不存在" or 404 (404 expected since no tenant rows yet)

Stop dev.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat(plan-1): add layout shells + error boundaries for all route groups

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase E — Platform Admin Seed + Invite Flow (Tasks 15-17)

### Task 15: Seed first platform admin

**Files:**
- Create: `supabase/seed.sql`
- Create: `scripts/seed-platform-admin.md` (instructions)

Seeding via SQL because there's no UI to elevate a user to platform admin (intentionally — security boundary).

- [ ] **Step 1: Sign up your own admin account first**

Open the dev server, go to `/signup`, register with your real email + password. Note the resulting `user_id` (from Supabase Dashboard → Authentication → Users).

- [ ] **Step 2: Create `supabase/seed.sql`**

```sql
-- supabase/seed.sql
-- Optional seed data for local/dev environments.
-- Production platform admins should be inserted manually via Supabase SQL Editor.

-- Example: uncomment and replace with your user_id to make yourself a platform admin
-- insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-000000000000');
```

- [ ] **Step 3: Insert yourself as platform admin (manual, one-time)**

In Supabase Dashboard → SQL Editor → New query, run (replace UUID with yours):

```sql
insert into public.platform_admins (user_id)
values ('YOUR-USER-UUID-FROM-AUTH-USERS')
on conflict (user_id) do nothing;
```

Expected: 1 row inserted.

- [ ] **Step 4: Verify**

Log in to dev app with the seeded user → visit `/`. Expected: redirects to `/platform/dashboard` showing "平台儀表板" page.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(plan-1): add seed.sql template; document platform admin bootstrap

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 16: Implement invite-coach Server Action (platform admin)

**Files:**
- Create: `src/app/(platform)/platform/tenants/actions.ts`
- Modify: `src/app/(platform)/platform/tenants/page.tsx` (add invite form)

- [ ] **Step 1: Create `src/app/(platform)/platform/tenants/actions.ts`**

```ts
'use server'

import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requirePlatformAdmin } from '@/lib/auth/get-session'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'

const SlugSchema = z
  .string()
  .min(2, 'slug 至少 2 個字')
  .max(40, 'slug 最多 40 個字')
  .regex(/^[a-z0-9-]+$/, '只允許小寫英數與短橫線')

const InviteCoachSchema = z.object({
  email: z.string().email('Email 格式不正確'),
  tenantName: z.string().min(1, '請填租戶名稱').max(60),
  tenantSlug: SlugSchema,
})

export const inviteCoachAction = actionClient
  .inputSchema(InviteCoachSchema)
  .action(async ({ parsedInput }) => {
    await requirePlatformAdmin()
    const supabase = createSupabaseAdminClient()

    // 1. Check slug is free
    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', parsedInput.tenantSlug)
      .maybeSingle()
    if (existing) throw new AppError('SLUG_TAKEN', '該 slug 已被使用')

    // 2. Create tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .insert({
        slug: parsedInput.tenantSlug,
        name: parsedInput.tenantName,
        status: 'active',
      })
      .select('id')
      .single()
    if (tenantErr || !tenant) throw new AppError('TENANT_CREATE_FAILED', tenantErr?.message ?? '建立租戶失敗')

    // 3. Create pending invite row (no user_id yet — assigned when invite is accepted)
    const inviteToken = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) // 7 days

    const { error: memberErr } = await supabase.from('tenant_members').insert({
      tenant_id: tenant.id,
      user_id: '00000000-0000-0000-0000-000000000000', // placeholder; will be replaced on accept
      role: 'owner',
      status: 'invited',
      invited_email: parsedInput.email,
      invite_token: inviteToken,
      invite_expires_at: expiresAt.toISOString(),
    })
    if (memberErr) {
      // Roll back tenant
      await supabase.from('tenants').delete().eq('id', tenant.id)
      throw new AppError('INVITE_CREATE_FAILED', memberErr.message)
    }

    revalidatePath('/platform/tenants')

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${inviteToken}`
    return {
      inviteUrl,
      tenantId: tenant.id,
    }
  })
```

**Note on the placeholder user_id:** Supabase's foreign-key to `auth.users(id)` cannot store a real null when we don't yet know the user. We use a sentinel zero-UUID and the invite-accept flow replaces it when the user signs up. An alternative is to make `user_id` nullable for `invited` status. We adjust this in Task 17 if cleaner.

Actually, looking at the schema in Task 7 — `user_id` is NOT NULL with a FK constraint. The placeholder UUID approach won't work because the FK would fail. Let's fix the schema instead.

- [ ] **Step 2: Add migration to allow null `user_id` for invited rows**

```bash
npx supabase migration new tenant_members_allow_null_user_for_invited
```

Edit the new migration:

```sql
-- Allow tenant_members.user_id to be NULL while status = 'invited' (pre-acceptance)
alter table public.tenant_members
  alter column user_id drop not null;

-- But require it when status = 'active'
alter table public.tenant_members
  drop constraint if exists tenant_members_user_id_required_when_active;
alter table public.tenant_members
  add constraint tenant_members_user_id_required_when_active
  check (status <> 'active' or user_id is not null);

-- Drop the old UNIQUE (tenant_id, user_id) and rebuild excluding nulls
alter table public.tenant_members
  drop constraint if exists tenant_members_tenant_id_user_id_key;
create unique index tenant_members_tenant_user_unique
  on public.tenant_members (tenant_id, user_id)
  where user_id is not null;
```

- [ ] **Step 3: Push migration + regenerate types**

```bash
npm run db:push
npm run db:types
```

- [ ] **Step 4: Revise `inviteCoachAction` to use null user_id**

Edit `src/app/(platform)/platform/tenants/actions.ts`, change the placeholder insert section to:

```ts
    const { error: memberErr } = await supabase.from('tenant_members').insert({
      tenant_id: tenant.id,
      user_id: null,
      role: 'owner',
      status: 'invited',
      invited_email: parsedInput.email,
      invite_token: inviteToken,
      invite_expires_at: expiresAt.toISOString(),
    })
```

- [ ] **Step 5: Add invite form to tenants page**

Modify `src/app/(platform)/platform/tenants/page.tsx` to add the form above the table:

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import InviteCoachForm from './invite-coach-form'

export default async function TenantsListPage() {
  const supabase = await createSupabaseServerClient()
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, slug, name, status, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">租戶管理</h1>
      </div>

      <InviteCoachForm />

      <div>
        <h2 className="mb-2 text-lg font-semibold">租戶列表</h2>
        <table className="w-full bg-white">
          <thead>
            <tr className="border-b text-left text-sm text-slate-600">
              <th className="p-3">Slug</th>
              <th className="p-3">名稱</th>
              <th className="p-3">狀態</th>
              <th className="p-3">建立日期</th>
            </tr>
          </thead>
          <tbody>
            {tenants?.map((t) => (
              <tr key={t.id} className="border-b text-sm">
                <td className="p-3">{t.slug}</td>
                <td className="p-3">{t.name}</td>
                <td className="p-3">{t.status}</td>
                <td className="p-3">{new Date(t.created_at).toLocaleDateString('zh-TW')}</td>
              </tr>
            ))}
            {!tenants?.length && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-400">
                  尚無租戶
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create `src/app/(platform)/platform/tenants/invite-coach-form.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { inviteCoachAction } from './actions'

export default function InviteCoachForm() {
  const [email, setEmail] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [tenantSlug, setTenantSlug] = useState('')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)

  const { execute, isPending } = useAction(inviteCoachAction, {
    onSuccess: ({ data }) => {
      toast.success('已建立邀請')
      setInviteUrl(data?.inviteUrl ?? null)
      setEmail('')
      setTenantName('')
      setTenantSlug('')
    },
    onError: ({ error }) => {
      toast.error(error.serverError?.message ?? '邀請失敗')
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>邀請新教練</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            execute({ email, tenantName, tenantSlug })
          }}
        >
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">教練 Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenantName">租戶名稱</Label>
              <Input
                id="tenantName"
                required
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenantSlug">Slug (公開連結)</Label>
              <Input
                id="tenantSlug"
                required
                placeholder="wang-coach"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? '邀請中...' : '送出邀請'}
          </Button>
        </form>
        {inviteUrl && (
          <div className="mt-4 rounded border bg-slate-50 p-3 text-sm">
            <p className="mb-1 font-semibold">邀請連結（請傳給教練）：</p>
            <code className="break-all">{inviteUrl}</code>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 7: Smoke test**

```bash
npm run dev
```

Logged in as platform admin → `/platform/tenants` → fill the form (e.g. `coach@example.com`, `王教練`, `wang-coach`) → submit. Expected: success toast + invite URL displayed + table updates to show the new tenant.

Stop dev.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(plan-1): platform admin can invite coaches via tokenized link

- new migration allows nullable user_id for invited tenant_members
- inviteCoachAction creates tenant + pending member row + invite token
- InviteCoachForm UI on /platform/tenants page

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 17: Implement invite acceptance flow

**Files:**
- Create: `src/app/invite/[token]/page.tsx`, `src/app/invite/[token]/actions.ts`

When a coach clicks the invite link they're taken to `/invite/<token>`. If not logged in, they're prompted to sign up (or log in if they already have an account); after auth, they accept the invite which assigns the `tenant_members` row to their user.

- [ ] **Step 1: Create `src/app/invite/[token]/actions.ts`**

```ts
'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { actionClient } from '@/lib/safe-action'
import { requireSession } from '@/lib/auth/get-session'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { AppError, NotFoundError } from '@/lib/errors'

const AcceptInviteSchema = z.object({
  token: z.string().length(64),
})

export const acceptInviteAction = actionClient
  .inputSchema(AcceptInviteSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireSession()
    const supabase = createSupabaseAdminClient()

    // 1. Find invite row by token
    const { data: invite, error: lookupErr } = await supabase
      .from('tenant_members')
      .select('id, tenant_id, role, status, invited_email, invite_expires_at')
      .eq('invite_token', parsedInput.token)
      .maybeSingle()
    if (lookupErr || !invite) throw new NotFoundError('邀請')

    // 2. Validate invite state
    if (invite.status !== 'invited') throw new AppError('INVITE_USED', '此邀請已被使用')
    if (new Date(invite.invite_expires_at!) < new Date())
      throw new AppError('INVITE_EXPIRED', '邀請已過期')
    if (invite.invited_email && session.email && invite.invited_email.toLowerCase() !== session.email.toLowerCase())
      throw new AppError('INVITE_EMAIL_MISMATCH', '邀請的 Email 與您登入的帳號不符')

    // 3. Assign to current user, mark as active, clear token
    const { error: updateErr } = await supabase
      .from('tenant_members')
      .update({
        user_id: session.userId,
        status: 'active',
        invite_token: null,
        invite_expires_at: null,
      })
      .eq('id', invite.id)
    if (updateErr) throw new AppError('INVITE_ACCEPT_FAILED', updateErr.message)

    redirect('/dashboard')
  })
```

- [ ] **Step 2: Create `src/app/invite/[token]/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/get-session'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import AcceptInviteButton from './accept-invite-button'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Look up invite (server-side, no RLS — uses admin client because invite_token is the auth proof)
  const supabase = createSupabaseAdminClient()
  const { data: invite } = await supabase
    .from('tenant_members')
    .select('id, status, invited_email, invite_expires_at, tenant:tenants(name, slug)')
    .eq('invite_token', token)
    .maybeSingle()

  if (!invite) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>邀請無效</CardTitle>
          </CardHeader>
          <CardContent>
            <p>此邀請連結不存在或已失效。</p>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (invite.status !== 'invited') {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>邀請已被使用</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/login">前往登入</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (new Date(invite.invite_expires_at!) < new Date()) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>邀請已過期</CardTitle>
          </CardHeader>
          <CardContent>
            <p>請聯絡平台管理員重新發送邀請。</p>
          </CardContent>
        </Card>
      </main>
    )
  }

  const session = await getSession()
  if (!session) {
    // Not logged in — direct to signup with prefilled email
    const signupUrl = `/signup?invite=${token}&email=${encodeURIComponent(invite.invited_email ?? '')}`
    redirect(signupUrl)
  }

  const tenant = invite.tenant as { name: string; slug: string }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>接受邀請</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            您被邀請成為 <strong>{tenant.name}</strong>（{tenant.slug}）的 Owner。
          </p>
          <p className="text-sm text-slate-600">登入帳號：{session.email}</p>
          <AcceptInviteButton token={token} />
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 3: Create `src/app/invite/[token]/accept-invite-button.tsx`**

```tsx
'use client'

import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { acceptInviteAction } from './actions'

export default function AcceptInviteButton({ token }: { token: string }) {
  const { execute, isPending } = useAction(acceptInviteAction, {
    onError: ({ error }) => {
      toast.error(error.serverError?.message ?? '接受邀請失敗')
    },
  })

  return (
    <Button onClick={() => execute({ token })} disabled={isPending}>
      {isPending ? '處理中...' : '接受邀請'}
    </Button>
  )
}
```

- [ ] **Step 4: Update `signup` page to handle `?invite=` and redirect back**

Modify `src/app/(auth)/signup/page.tsx` — change the URL search-param handling to forward the invite:

Replace the imports section at top to include `useSearchParams`:

```tsx
import { useSearchParams } from 'next/navigation'
```

In the component body, add:

```tsx
  const params = useSearchParams()
  const inviteToken = params.get('invite')
  const presetEmail = params.get('email') ?? ''
```

Change `const [email, setEmail] = useState('')` to `const [email, setEmail] = useState(presetEmail)`.

In `signupAction` invocation, modify the redirect: edit `src/app/(auth)/signup/actions.ts` to accept optional `inviteToken` and forward:

```ts
const SignupSchema = z.object({
  email: z.string().email('Email 格式不正確'),
  password: z.string().min(8, '密碼至少 8 個字'),
  displayName: z.string().min(1, '請輸入姓名').max(50),
  inviteToken: z.string().optional(),
})

export const signupAction = actionClient
  .inputSchema(SignupSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseServerClient()
    const { error, data } = await supabase.auth.signUp({
      email: parsedInput.email,
      password: parsedInput.password,
      options: {
        data: { display_name: parsedInput.displayName },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/callback`,
      },
    })
    if (error) throw new AppError('SIGNUP_FAILED', error.message)
    if (!data.user) throw new AppError('SIGNUP_FAILED', '註冊失敗')

    await supabase.from('customers').upsert({
      id: data.user.id,
      display_name: parsedInput.displayName,
    })

    // If we have an invite token, redirect to the invite page (post-login)
    if (parsedInput.inviteToken) {
      redirect(`/login?redirect=/invite/${parsedInput.inviteToken}`)
    }
    redirect('/login?signedup=1')
  })
```

And in `src/app/(auth)/signup/page.tsx`, pass `inviteToken`:

```tsx
            execute({ email, password, displayName, inviteToken: inviteToken ?? undefined })
```

- [ ] **Step 5: Smoke test the full flow**

```bash
npm run dev
```

1. **As platform admin** (logged in already from Task 16): generate invite for `coach1@example.com` → copy invite URL
2. **As anonymous** (open incognito/private window): visit invite URL → redirected to signup with email prefilled → register → redirected to login with `redirect` param → log in → redirected to invite page → click "接受邀請" → land at `/dashboard` showing the tenant name in sidebar

Verify in Supabase Dashboard:
- `tenants` has 1 row
- `tenant_members` has 1 row with `status = 'active'`, `user_id` filled, `invite_token = NULL`

Stop dev.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(plan-1): invite acceptance flow for new tenant owners

- /invite/[token] page validates and displays invite
- acceptInviteAction binds invite to current user, activates membership
- signup page forwards invite token to login → invite page

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase F — Integration Test + CI (Tasks 18-20)

### Task 18: RLS integration smoke test

**Files:**
- Create: `tests/integration/rls-identity.test.ts`

This test creates two tenants with their respective owners and verifies that Tenant A's Owner cannot see Tenant B's `tenant_members` rows (RLS proof). Run against the linked Supabase project; uses service_role to set up data, then a real user JWT to verify isolation.

- [ ] **Step 1: Write the test**

Create `tests/integration/rls-identity.test.ts`:

```ts
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY)

const fixtures: { tenantAId?: string; tenantBId?: string; userAEmail: string; userBEmail: string; userAPassword: string; userBPassword: string } = {
  userAEmail: `rls-test-a-${Date.now()}@example.com`,
  userBEmail: `rls-test-b-${Date.now()}@example.com`,
  userAPassword: 'TestPass123!',
  userBPassword: 'TestPass123!',
}

describe('Identity RLS isolation', () => {
  beforeAll(async () => {
    // Create users via admin API
    const { data: userA } = await admin.auth.admin.createUser({
      email: fixtures.userAEmail,
      password: fixtures.userAPassword,
      email_confirm: true,
    })
    const { data: userB } = await admin.auth.admin.createUser({
      email: fixtures.userBEmail,
      password: fixtures.userBPassword,
      email_confirm: true,
    })

    // Create two tenants
    const { data: tenantA } = await admin
      .from('tenants')
      .insert({ slug: `rls-a-${Date.now()}`, name: 'Tenant A' })
      .select()
      .single()
    const { data: tenantB } = await admin
      .from('tenants')
      .insert({ slug: `rls-b-${Date.now()}`, name: 'Tenant B' })
      .select()
      .single()
    fixtures.tenantAId = tenantA!.id
    fixtures.tenantBId = tenantB!.id

    // Assign users as owners
    await admin.from('tenant_members').insert([
      { tenant_id: tenantA!.id, user_id: userA!.user!.id, role: 'owner', status: 'active' },
      { tenant_id: tenantB!.id, user_id: userB!.user!.id, role: 'owner', status: 'active' },
    ])
  }, 30_000)

  afterAll(async () => {
    if (fixtures.tenantAId) await admin.from('tenants').delete().eq('id', fixtures.tenantAId)
    if (fixtures.tenantBId) await admin.from('tenants').delete().eq('id', fixtures.tenantBId)
    // Note: auth users persist; manual cleanup if needed
  }, 30_000)

  it('Tenant A owner cannot see Tenant B members', async () => {
    const userAClient = createClient<Database>(SUPABASE_URL, ANON_KEY)
    const { error: signInErr } = await userAClient.auth.signInWithPassword({
      email: fixtures.userAEmail,
      password: fixtures.userAPassword,
    })
    expect(signInErr).toBeNull()

    const { data, error } = await userAClient
      .from('tenant_members')
      .select('id, tenant_id')
      .eq('tenant_id', fixtures.tenantBId!)
    expect(error).toBeNull()
    expect(data).toEqual([]) // No rows visible
  })

  it('Tenant A owner CAN see own tenant members', async () => {
    const userAClient = createClient<Database>(SUPABASE_URL, ANON_KEY)
    await userAClient.auth.signInWithPassword({
      email: fixtures.userAEmail,
      password: fixtures.userAPassword,
    })

    const { data } = await userAClient
      .from('tenant_members')
      .select('id, tenant_id')
      .eq('tenant_id', fixtures.tenantAId!)
    expect(data?.length).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Add test:integration script**

Modify `package.json` `"scripts"`:

```json
"test:integration": "vitest run tests/integration --reporter=verbose"
```

- [ ] **Step 3: Run the test**

```bash
npm run test:integration
```

Expected: 2 tests pass. If they fail with auth errors, double-check `.env.local` has the right `SUPABASE_SERVICE_ROLE_KEY` (must be the secret/service_role, not the publishable/anon).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(plan-1): integration test proves identity RLS isolation

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 19: GitHub Actions CI (lint + typecheck + unit tests)

**Files:**
- Create: `.github/workflows/ci.yml`

CI runs on every PR and on pushes to master. We skip integration tests in CI (they need live Supabase creds and are slow) — integration tests run locally before pushing.

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [master]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Format check
        run: npm run format:check

      - name: Typecheck
        run: npm run typecheck

      - name: Unit tests
        run: npm run test
        env:
          # Provide dummy values so `import.meta.env` references don't crash
          NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: dummy

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: dummy
          SUPABASE_SERVICE_ROLE_KEY: dummy
          NEXT_PUBLIC_APP_URL: http://localhost:3000
          CRON_SECRET: dummy
```

- [ ] **Step 2: Push and verify**

```bash
git add -A
git commit -m "ci(plan-1): GitHub Actions for lint, typecheck, unit tests, build

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin master
```

Open GitHub → Actions tab. Expected: workflow runs and all steps pass green.

---

### Task 20: Final smoke deploy + Plan 1 acceptance

**Files:** (none — this is verification)

- [ ] **Step 1: Pull a fresh checkout of master and verify**

```bash
# in a temp dir
git clone https://github.com/TerryRD/QuickReserve.git fresh-check
cd fresh-check
npm install
cp .env.local.example .env.local  # then edit values
npm run build
npm run test
```

Expected: all pass.

- [ ] **Step 2: Verify production deploy**

Visit your Vercel production URL (e.g. `quick-reserve.vercel.app`):
- `/` shows landing
- `/login` and `/signup` work
- Sign up as test user → fill `customers` row
- Log out, log in as platform admin → `/platform/dashboard`
- `/platform/tenants` → create test tenant via invite form → get invite URL
- Open invite URL in incognito → accept → land at `/dashboard` with tenant name in sidebar

- [ ] **Step 3: Acceptance checklist (Plan 1 done when all true)**

- [ ] `npm run build` succeeds locally and on Vercel
- [ ] `npm run lint` and `npm run typecheck` pass with no warnings on master
- [ ] All unit tests pass (`npm run test`)
- [ ] RLS integration test passes (`npm run test:integration`)
- [ ] Platform admin can log in and reach `/platform/dashboard`
- [ ] Platform admin can invite a coach; invite URL works
- [ ] Coach can accept invite (after signing up) and reach `/dashboard` showing their tenant
- [ ] Logged-out users can't reach `/platform/*` or `/dashboard` (middleware redirects)
- [ ] Two different coaches can't see each other's `tenant_members` rows (RLS proof)
- [ ] CI workflow green on master

- [ ] **Step 4: Final commit + tag**

```bash
git tag -a plan-1-foundation -m "Plan 1 complete: foundation, auth, multi-tenant identity"
git push origin plan-1-foundation
```

---

## Self-Review

Spec coverage check (sections from spec ↔ tasks in this plan):

| Spec section | Implemented in Plan 1? | Tasks |
|--------------|----------------------|-------|
| §3 roles (platform admin, owner, staff, customer) | ✓ | Task 8 (RLS), Task 11 (helpers), Task 15 (seed) |
| §6.3 routing structure | ✓ partial | Task 14 (auth, platform, tenant, customer shells) — services/calendar/bookings deferred |
| §7.2 identity schema | ✓ | Task 7 |
| §7.3 RLS for identity tables | ✓ | Task 8 |
| §8 four-layer security | ✓ | Tasks 8 (L4), 10 (L3), 12 (L2). L1 rate limit deferred to Plan 7 |
| §11 error handling | ✓ | Tasks 9, 10, 14 (error.tsx) |
| §13 services / slots / bookings / notifications | ✗ deferred | Plans 2-6 |
| §14 deployment | ✓ partial | Task 4. Lighthouse CI in Plan 7 |

Placeholder scan: no TBD/TODO/"similar to" found. Every code-bearing step contains complete code.

Type consistency: `Session`, `AppUserRole`, `TenantContext` defined in Task 11, used in Tasks 12-17. `inviteCoachAction`/`acceptInviteAction` use `tenant_members` columns that match the schema in Tasks 7+16. `actionClient` signature consistent across all `'use server'` files.

Scope: ~20 tasks producing a fully functional, deployed identity + auth foundation. Subsequent plans (2-7) build on this scaffold.
