# S5 — 教練介紹頁 + 學員登入流程 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire 既有 `avatar_url`、新增 bio rich-text / intro video / photo gallery（含 Supabase Storage bucket）至教練後台與公開頁；修補學員 signup 流程使其能保留 `?redirect=` 並支援 auto-login，公開頁未登入時顯示 CTA。

**Architecture:** `tenants` 加 2 欄（`bio_html`, `intro_video_url`），新表 `tenant_photos` 由 server actions 操作，照片實體存 Supabase Storage bucket `coach-media`（client-side upload + Storage RLS 強制 tenant 隔離）。Bio 用 TipTap + `@tiptap/starter-kit` + Link 編輯、`sanitize-html` server-side 過濾後存 DB。影片只接 YouTube / Vimeo URL（regex whitelist 解析 → iframe 用 ID 重組）。signup action 加 `redirectTo` + open-redirect 防護，公開頁未登入時 `AuthCta` 帶 `redirect=<current_url>` 給 /login 與 /signup。

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Supabase (PostgreSQL + RLS + Storage), Vitest, next-safe-action + Zod, Tailwind + shadcn/ui (base-ui), `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `sanitize-html`.

**Spec reference:** [`docs/superpowers/specs/2026-05-26-s5-coach-page-and-auth-design.md`](../specs/2026-05-26-s5-coach-page-and-auth-design.md)

**Out of scope:** 影片實體上傳、多區塊 bio、Magic link / OTP UI、照片 drag-reorder、教練介紹頁主題色客製化（S6 做）、教練介紹頁 SEO meta tags。

---

## File Map

**Create**

**Migrations**（4 個 SQL 檔，timestamp 連續）：
- `supabase/migrations/20260526100000_tenants_intro_columns.sql`
- `supabase/migrations/20260526100001_tenant_photos_schema.sql`
- `supabase/migrations/20260526100002_tenant_photos_rls.sql`
- `supabase/migrations/20260526100003_storage_coach_media_bucket.sql`

**Library code**：
- `src/lib/sanitize.ts` — `sanitizeBioHtml()`
- `src/lib/storage.ts` — `uploadCoachMedia()`, `getCoachMediaPublicUrl()`, `deleteCoachMedia()`
- `src/components/public-page/video-embed.tsx` — `parseVideoUrl()` + `<VideoEmbed/>`
- `src/components/public-page/bio-block.tsx` — `<BioBlock html={...}/>`
- `src/components/public-page/photo-gallery.tsx` — `<PhotoGallery photos={...}/>`
- `src/components/public-page/auth-cta.tsx` — `<AuthCta returnPath={...}/>`

**Tests**：
- `tests/unit/sanitize.test.ts`
- `tests/unit/video-embed.test.ts`

**後台（/settings/profile）**：
- `src/app/(tenant)/settings/profile/avatar-uploader.tsx`
- `src/app/(tenant)/settings/profile/bio-editor.tsx` (TipTap, `'use client'`)
- `src/app/(tenant)/settings/profile/video-input.tsx`
- `src/app/(tenant)/settings/profile/photo-gallery-manager.tsx`
- `src/app/(tenant)/settings/profile/photo-actions.ts` — `addPhotoAction`, `updatePhotoCaptionAction`, `deletePhotoAction`

**Modify**：
- `src/lib/supabase/types.ts` — regen
- `src/lib/auth/get-tenant-context.ts` — `getTenantBySlug` 加 `avatar_url, bio_html, intro_video_url`
- `src/app/(tenant)/settings/profile/page.tsx` — query 新欄位 + tenant_photos + 引入新 components
- `src/app/(tenant)/settings/profile/profile-form.tsx` — 拆基本資料與聯絡，section 重組
- `src/app/(tenant)/settings/profile/actions.ts` — `updateTenantProfileAction` 加 `avatarUrl`/`bioHtml`/`introVideoUrl`（後兩者 sanitize/validate）
- `src/app/[tenantSlug]/page.tsx` — hero 加 avatar inset + Bio + Video + Gallery + AuthCta
- `src/app/[tenantSlug]/packages/page.tsx` — header 加 AuthCta
- `src/app/(auth)/signup/actions.ts` — 加 `redirectTo` + open-redirect 防護
- `src/app/(auth)/signup/page.tsx` — `?redirect=` 取出並 forward 給 action
- `src/app/(auth)/login/actions.ts` — open-redirect 防護
- `package.json` — `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `sanitize-html`, `@types/sanitize-html`
- `scripts/seed-test-data.mjs` — 林教練 avatar URL + bio + 1 video + 2 photos demo
- `README.md` — 加「教練介紹頁 / Storage bucket / Auth flow」三節
- `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md` 附錄 C — FR-131~136 + commit hash

---

## Task 1: 安裝 TipTap + sanitize-html 依賴

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安裝依賴**

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link sanitize-html
npm install -D @types/sanitize-html
```

- [ ] **Step 2: 確認版本鎖入 package.json + lockfile**

Run: `npm ls @tiptap/react @tiptap/starter-kit @tiptap/extension-link sanitize-html`
Expected: 全部顯示版本（無 missing）

- [ ] **Step 3: 跑 typecheck 確認 baseline 仍綠**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore(s5): add TipTap + sanitize-html deps for coach intro page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Migration — tenants 加 bio_html + intro_video_url

**Files:**
- Create: `supabase/migrations/20260526100000_tenants_intro_columns.sql`

- [ ] **Step 1: 建檔**

```sql
-- supabase/migrations/20260526100000_tenants_intro_columns.sql
alter table public.tenants
  add column bio_html text,
  add column intro_video_url text;

comment on column public.tenants.bio_html is 'Sanitized HTML for coach bio (rich text). Set via updateTenantProfileAction after sanitize-html filter.';
comment on column public.tenants.intro_video_url is 'YouTube or Vimeo URL; only host/id are used to compose iframe src.';
```

- [ ] **Step 2: 套用 migration**

Run: `npm run db:push`
Expected: 1 migration applied 訊息

- [ ] **Step 3: 確認欄位存在**

Run（in app SQL editor or psql）：

```sql
select column_name, data_type from information_schema.columns
 where table_schema='public' and table_name='tenants'
   and column_name in ('bio_html','intro_video_url');
```

Expected: 2 rows, 兩者皆 `text`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260526100000_tenants_intro_columns.sql
git commit -m "$(cat <<'EOF'
feat(s5): add tenants.bio_html + intro_video_url (FR-133/134)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Migration — tenant_photos schema

**Files:**
- Create: `supabase/migrations/20260526100001_tenant_photos_schema.sql`

- [ ] **Step 1: 建檔**

```sql
-- supabase/migrations/20260526100001_tenant_photos_schema.sql
create table public.tenant_photos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  storage_path text not null,
  caption text,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_tenant_photos_tenant_order
  on public.tenant_photos(tenant_id, display_order, created_at);

comment on table public.tenant_photos is 'Coach intro page photos. storage_path = <tenant_id>/<uuid>.<ext> in coach-media bucket. Max 10 per tenant (enforced in server action).';
```

- [ ] **Step 2: 套用 + 確認**

Run: `npm run db:push`

Run（SQL）：

```sql
select count(*) from public.tenant_photos;  -- 0
```

Expected: 0

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260526100001_tenant_photos_schema.sql
git commit -m "$(cat <<'EOF'
feat(s5): tenant_photos table schema (FR-132)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Migration — tenant_photos RLS

**Files:**
- Create: `supabase/migrations/20260526100002_tenant_photos_rls.sql`

- [ ] **Step 1: 建檔**（沿用既有 service_packages_rls 模式）

```sql
-- supabase/migrations/20260526100002_tenant_photos_rls.sql
alter table public.tenant_photos enable row level security;

-- Public read (學員瀏覽公開頁) — 任何 active tenant 的照片
create policy tenant_photos_select_public on public.tenant_photos for select
  using (
    tenant_id in (select id from public.tenants where status = 'active')
  );

-- Tenant members read their own
create policy tenant_photos_select_member on public.tenant_photos for select
  using (tenant_id in (select current_user_tenant_ids()));

-- Platform admin sees all
create policy tenant_photos_select_admin on public.tenant_photos for select
  using (is_platform_admin());

-- Only owner can write
create policy tenant_photos_insert_owner on public.tenant_photos for insert
  with check (tenant_id in (select current_user_owner_tenant_ids()));
create policy tenant_photos_update_owner on public.tenant_photos for update
  using (tenant_id in (select current_user_owner_tenant_ids()));
create policy tenant_photos_delete_owner on public.tenant_photos for delete
  using (tenant_id in (select current_user_owner_tenant_ids()));
```

- [ ] **Step 2: 套用**

Run: `npm run db:push`
Expected: migration applied

- [ ] **Step 3: 確認 RLS enabled**

Run（SQL）：

```sql
select relname, relrowsecurity from pg_class where relname='tenant_photos';
```

Expected: `relrowsecurity = true`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260526100002_tenant_photos_rls.sql
git commit -m "$(cat <<'EOF'
feat(s5): tenant_photos RLS — public read + owner write

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Migration — Storage bucket coach-media + RLS

**Files:**
- Create: `supabase/migrations/20260526100003_storage_coach_media_bucket.sql`

- [ ] **Step 1: 建檔**

```sql
-- supabase/migrations/20260526100003_storage_coach_media_bucket.sql

-- Bucket: public read (URLs are public), 5MB file limit, image MIME only
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'coach-media',
  'coach-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- RLS policies on storage.objects
-- Path format: <tenant_id>/<filename>
-- foldername(name)[1] = first path segment, cast to uuid → must be in caller's owner tenants

drop policy if exists coach_media_select_public on storage.objects;
create policy coach_media_select_public on storage.objects for select
  using (bucket_id = 'coach-media');

drop policy if exists coach_media_insert_owner on storage.objects;
create policy coach_media_insert_owner on storage.objects for insert
  with check (
    bucket_id = 'coach-media'
    and (storage.foldername(name))[1]::uuid in (
      select current_user_owner_tenant_ids()
    )
  );

drop policy if exists coach_media_update_owner on storage.objects;
create policy coach_media_update_owner on storage.objects for update
  using (
    bucket_id = 'coach-media'
    and (storage.foldername(name))[1]::uuid in (
      select current_user_owner_tenant_ids()
    )
  );

drop policy if exists coach_media_delete_owner on storage.objects;
create policy coach_media_delete_owner on storage.objects for delete
  using (
    bucket_id = 'coach-media'
    and (storage.foldername(name))[1]::uuid in (
      select current_user_owner_tenant_ids()
    )
  );
```

- [ ] **Step 2: 套用**

Run: `npm run db:push`
Expected: migration applied

- [ ] **Step 3: 確認 bucket 存在**

Run（SQL）：

```sql
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id='coach-media';
```

Expected: 1 row, `public=true`, `file_size_limit=5242880`, MIME array 含 jpeg/png/webp

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260526100003_storage_coach_media_bucket.sql
git commit -m "$(cat <<'EOF'
feat(s5): coach-media storage bucket + tenant-scoped RLS

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Regen types + update getTenantBySlug

**Files:**
- Modify: `src/lib/supabase/types.ts`（generated）
- Modify: `src/lib/auth/get-tenant-context.ts`

- [ ] **Step 1: Regen Supabase types**

Run: `npm run db:types`
Expected: `src/lib/supabase/types.ts` 更新，含 `tenant_photos` table + tenants.bio_html / intro_video_url

- [ ] **Step 2: 修改 `getTenantBySlug` 帶新欄位**

Edit `src/lib/auth/get-tenant-context.ts`:

```ts
export type PublicTenant = TenantContext & {
  description: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_line_id: string | null
  contact_note: string | null
  avatar_url: string | null
  bio_html: string | null
  intro_video_url: string | null
}

export async function getTenantBySlug(slug: string): Promise<PublicTenant | null> {
  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from('tenants')
    .select(
      'id, slug, name, status, description, contact_email, contact_phone, contact_line_id, contact_note, avatar_url, bio_html, intro_video_url',
    )
    .eq('slug', slug)
    .maybeSingle()
  return (data as PublicTenant) ?? null
}
```

- [ ] **Step 3: 跑 typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/types.ts src/lib/auth/get-tenant-context.ts
git commit -m "$(cat <<'EOF'
feat(s5): regen types + getTenantBySlug returns new media fields

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: sanitize.ts + 單元測試（TDD）

**Files:**
- Create: `tests/unit/sanitize.test.ts`
- Create: `src/lib/sanitize.ts`

- [ ] **Step 1: 寫失敗測試**

```ts
// tests/unit/sanitize.test.ts
import { describe, it, expect } from 'vitest'
import { sanitizeBioHtml } from '@/lib/sanitize'

describe('sanitizeBioHtml', () => {
  it('keeps allowed tags', () => {
    const input = '<p>hello <strong>world</strong></p><ul><li>one</li></ul>'
    expect(sanitizeBioHtml(input)).toBe(input)
  })

  it('strips <script>', () => {
    const input = '<p>safe</p><script>alert(1)</script>'
    expect(sanitizeBioHtml(input)).toBe('<p>safe</p>')
  })

  it('strips inline event handlers', () => {
    const input = '<p onclick="alert(1)">x</p>'
    expect(sanitizeBioHtml(input)).toBe('<p>x</p>')
  })

  it('strips style attribute', () => {
    const input = '<p style="color:red">x</p>'
    expect(sanitizeBioHtml(input)).toBe('<p>x</p>')
  })

  it('rewrites links with rel + target', () => {
    const input = '<a href="https://example.com">link</a>'
    const out = sanitizeBioHtml(input)
    expect(out).toContain('rel="noopener noreferrer"')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('href="https://example.com"')
  })

  it('strips javascript: URLs', () => {
    const input = '<a href="javascript:alert(1)">x</a>'
    const out = sanitizeBioHtml(input)
    expect(out).not.toContain('javascript:')
  })

  it('allows mailto: links', () => {
    const out = sanitizeBioHtml('<a href="mailto:a@b.com">mail</a>')
    expect(out).toContain('href="mailto:a@b.com"')
  })

  it('strips <iframe>', () => {
    expect(sanitizeBioHtml('<iframe src="x"></iframe><p>ok</p>')).toBe('<p>ok</p>')
  })

  it('returns empty string for empty input', () => {
    expect(sanitizeBioHtml('')).toBe('')
  })
})
```

- [ ] **Step 2: 跑測試確認 FAIL**

Run: `npm test -- tests/unit/sanitize.test.ts`
Expected: FAIL — `Cannot find module '@/lib/sanitize'`

- [ ] **Step 3: 實作 `src/lib/sanitize.ts`**

```ts
// src/lib/sanitize.ts
import sanitizeHtml from 'sanitize-html'

export function sanitizeBioHtml(input: string): string {
  if (!input) return ''
  return sanitizeHtml(input, {
    allowedTags: [
      'p', 'br',
      'h1', 'h2', 'h3',
      'strong', 'em', 'u', 's',
      'ul', 'ol', 'li',
      'a',
      'blockquote', 'code',
    ],
    allowedAttributes: {
      a: ['href', 'rel', 'target'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
  })
}
```

- [ ] **Step 4: 跑測試確認 PASS**

Run: `npm test -- tests/unit/sanitize.test.ts`
Expected: 9 PASS

- [ ] **Step 5: Commit**

```bash
git add tests/unit/sanitize.test.ts src/lib/sanitize.ts
git commit -m "$(cat <<'EOF'
feat(s5): sanitizeBioHtml — whitelist-based XSS filter for coach bio

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: video-embed parseVideoUrl + VideoEmbed component（TDD）

**Files:**
- Create: `tests/unit/video-embed.test.ts`
- Create: `src/components/public-page/video-embed.tsx`

- [ ] **Step 1: 寫失敗測試**

```ts
// tests/unit/video-embed.test.ts
import { describe, it, expect } from 'vitest'
import { parseVideoUrl } from '@/components/public-page/video-embed'

describe('parseVideoUrl', () => {
  it('parses youtube.com/watch?v=', () => {
    expect(parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      provider: 'youtube',
      id: 'dQw4w9WgXcQ',
    })
  })

  it('parses youtu.be short link', () => {
    expect(parseVideoUrl('https://youtu.be/dQw4w9WgXcQ')).toEqual({
      provider: 'youtube',
      id: 'dQw4w9WgXcQ',
    })
  })

  it('parses youtube.com/embed/', () => {
    expect(parseVideoUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toEqual({
      provider: 'youtube',
      id: 'dQw4w9WgXcQ',
    })
  })

  it('parses vimeo.com', () => {
    expect(parseVideoUrl('https://vimeo.com/123456789')).toEqual({
      provider: 'vimeo',
      id: '123456789',
    })
  })

  it('returns null for unknown provider', () => {
    expect(parseVideoUrl('https://dailymotion.com/x')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseVideoUrl('')).toBeNull()
  })

  it('returns null for malformed URL', () => {
    expect(parseVideoUrl('not a url')).toBeNull()
  })
})
```

- [ ] **Step 2: 跑測試確認 FAIL**

Run: `npm test -- tests/unit/video-embed.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: 實作 component**

```tsx
// src/components/public-page/video-embed.tsx
export type ParsedVideo = { provider: 'youtube' | 'vimeo'; id: string }

export function parseVideoUrl(url: string): ParsedVideo | null {
  if (!url) return null
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (yt) return { provider: 'youtube', id: yt[1]! }
  const vm = url.match(/vimeo\.com\/(\d+)/)
  if (vm) return { provider: 'vimeo', id: vm[1]! }
  return null
}

export function VideoEmbed({ url }: { url: string | null | undefined }) {
  if (!url) return null
  const parsed = parseVideoUrl(url)
  if (!parsed) return null
  const src =
    parsed.provider === 'youtube'
      ? `https://www.youtube.com/embed/${parsed.id}`
      : `https://player.vimeo.com/video/${parsed.id}`
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border bg-black">
      <iframe
        src={src}
        title="教練介紹影片"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
      />
    </div>
  )
}
```

- [ ] **Step 4: 跑測試確認 PASS**

Run: `npm test -- tests/unit/video-embed.test.ts`
Expected: 7 PASS

- [ ] **Step 5: Commit**

```bash
git add tests/unit/video-embed.test.ts src/components/public-page/video-embed.tsx
git commit -m "$(cat <<'EOF'
feat(s5): parseVideoUrl + VideoEmbed (YouTube/Vimeo whitelist, FR-133)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: storage helper — uploadCoachMedia / publicUrl / delete

**Files:**
- Create: `src/lib/storage.ts`

- [ ] **Step 1: 實作 helper**

```ts
// src/lib/storage.ts
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'

export const COACH_MEDIA_BUCKET = 'coach-media'

/**
 * Returns a public URL for an object in the coach-media bucket.
 * The bucket is public, so the URL doesn't require auth.
 */
export function getCoachMediaPublicUrl(storagePath: string): string {
  const admin = createSupabaseAdminClient()
  const { data } = admin.storage.from(COACH_MEDIA_BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

/**
 * Server-side upload (used by avatar uploader server action).
 * Photo gallery uses client-side upload through the browser Supabase client
 * to benefit from streaming + RLS enforcement.
 */
export async function uploadCoachMedia(opts: {
  tenantId: string
  filename: string
  body: Blob | ArrayBuffer | Uint8Array
  contentType: string
}): Promise<{ path: string; publicUrl: string }> {
  const supabase = await createSupabaseServerClient()
  const path = `${opts.tenantId}/${opts.filename}`
  const { error } = await supabase.storage
    .from(COACH_MEDIA_BUCKET)
    .upload(path, opts.body, { contentType: opts.contentType, upsert: true })
  if (error) throw new AppError('STORAGE_UPLOAD_FAILED', error.message)
  return { path, publicUrl: getCoachMediaPublicUrl(path) }
}

export async function deleteCoachMedia(storagePath: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.storage.from(COACH_MEDIA_BUCKET).remove([storagePath])
  if (error) throw new AppError('STORAGE_DELETE_FAILED', error.message)
}
```

- [ ] **Step 2: 跑 typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/storage.ts
git commit -m "$(cat <<'EOF'
feat(s5): storage helper for coach-media bucket

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: photo-actions.ts — add / updateCaption / delete

**Files:**
- Create: `src/app/(tenant)/settings/profile/photo-actions.ts`

- [ ] **Step 1: 實作 3 個 server actions**

```ts
// src/app/(tenant)/settings/profile/photo-actions.ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireTenantOwner } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'
import { deleteCoachMedia } from '@/lib/storage'

const PHOTO_LIMIT = 10

const AddPhotoSchema = z.object({
  storagePath: z.string().min(1),
  caption: z.string().max(140).optional().nullable(),
})

export const addPhotoAction = actionClient.inputSchema(AddPhotoSchema).action(async ({ parsedInput }) => {
  const session = await requireTenantOwner()
  // path must start with tenant_id/
  if (!parsedInput.storagePath.startsWith(`${session.tenantId}/`)) {
    throw new AppError('PHOTO_PATH_MISMATCH', '上傳路徑不符')
  }
  const supabase = await createSupabaseServerClient()
  const { count, error: cntErr } = await supabase
    .from('tenant_photos')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', session.tenantId)
  if (cntErr) throw new AppError('PHOTO_COUNT_FAILED', cntErr.message)
  if ((count ?? 0) >= PHOTO_LIMIT) {
    throw new AppError('PHOTO_LIMIT_REACHED', `最多 ${PHOTO_LIMIT} 張照片`)
  }
  const { error } = await supabase.from('tenant_photos').insert({
    tenant_id: session.tenantId,
    storage_path: parsedInput.storagePath,
    caption: parsedInput.caption ?? null,
    display_order: count ?? 0,
  })
  if (error) throw new AppError('PHOTO_INSERT_FAILED', error.message)
  revalidatePath('/settings/profile')
  return { ok: true }
})

const UpdateCaptionSchema = z.object({
  id: z.string().uuid(),
  caption: z.string().max(140).optional().nullable(),
})

export const updatePhotoCaptionAction = actionClient
  .inputSchema(UpdateCaptionSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantOwner()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('tenant_photos')
      .update({ caption: parsedInput.caption ?? null })
      .eq('id', parsedInput.id)
      .eq('tenant_id', session.tenantId)
    if (error) throw new AppError('PHOTO_UPDATE_FAILED', error.message)
    revalidatePath('/settings/profile')
    return { ok: true }
  })

const DeletePhotoSchema = z.object({ id: z.string().uuid() })

export const deletePhotoAction = actionClient.inputSchema(DeletePhotoSchema).action(async ({ parsedInput }) => {
  const session = await requireTenantOwner()
  const supabase = await createSupabaseServerClient()
  const { data: row, error: selErr } = await supabase
    .from('tenant_photos')
    .select('storage_path')
    .eq('id', parsedInput.id)
    .eq('tenant_id', session.tenantId)
    .maybeSingle()
  if (selErr) throw new AppError('PHOTO_LOOKUP_FAILED', selErr.message)
  if (!row) throw new AppError('PHOTO_NOT_FOUND', '找不到照片')
  const { error: delErr } = await supabase
    .from('tenant_photos')
    .delete()
    .eq('id', parsedInput.id)
    .eq('tenant_id', session.tenantId)
  if (delErr) throw new AppError('PHOTO_DELETE_FAILED', delErr.message)
  // Best-effort: remove file (ignore failure to avoid blocking row deletion)
  try {
    await deleteCoachMedia(row.storage_path)
  } catch {
    // file may already be gone; row delete is the source of truth
  }
  revalidatePath('/settings/profile')
  return { ok: true }
})
```

- [ ] **Step 2: 跑 typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "src/app/(tenant)/settings/profile/photo-actions.ts"
git commit -m "$(cat <<'EOF'
feat(s5): photo server actions — add/updateCaption/delete (10-photo limit)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: updateTenantProfileAction 擴充 avatar / bio / video

**Files:**
- Modify: `src/app/(tenant)/settings/profile/actions.ts`

- [ ] **Step 1: 改寫 action（保留現有欄位 + 加新 3 欄位 + sanitize + URL validate）**

```ts
// src/app/(tenant)/settings/profile/actions.ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireTenantOwner } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'
import { sanitizeBioHtml } from '@/lib/sanitize'
import { parseVideoUrl } from '@/components/public-page/video-embed'

const UpdateProfileSchema = z.object({
  name: z.string().min(1, '請填租戶名稱').max(60),
  description: z.string().max(500).optional().nullable(),
  contactEmail: z.string().email().or(z.literal('')).optional().nullable(),
  contactPhone: z.string().max(40).optional().nullable(),
  contactLineId: z.string().max(40).optional().nullable(),
  contactNote: z.string().max(280).optional().nullable(),
  avatarUrl: z.string().url().or(z.literal('')).optional().nullable(),
  bioHtml: z.string().max(20_000).optional().nullable(),
  introVideoUrl: z.string().url().or(z.literal('')).optional().nullable(),
})

export const updateTenantProfileAction = actionClient
  .inputSchema(UpdateProfileSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantOwner()

    // Validate video URL (if provided, must be YouTube or Vimeo)
    if (parsedInput.introVideoUrl && parseVideoUrl(parsedInput.introVideoUrl) === null) {
      throw new AppError('INVALID_VIDEO_URL', '只接受 YouTube 或 Vimeo 連結')
    }

    const cleanBio = parsedInput.bioHtml ? sanitizeBioHtml(parsedInput.bioHtml) : null

    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('tenants')
      .update({
        name: parsedInput.name,
        description: parsedInput.description ?? null,
        contact_email: parsedInput.contactEmail || null,
        contact_phone: parsedInput.contactPhone || null,
        contact_line_id: parsedInput.contactLineId || null,
        contact_note: parsedInput.contactNote || null,
        avatar_url: parsedInput.avatarUrl || null,
        bio_html: cleanBio,
        intro_video_url: parsedInput.introVideoUrl || null,
      })
      .eq('id', session.tenantId)
    if (error) throw new AppError('TENANT_UPDATE_FAILED', error.message)
    revalidatePath('/settings/profile')
    revalidatePath('/dashboard')
    return { ok: true }
  })
```

- [ ] **Step 2: 跑 typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "src/app/(tenant)/settings/profile/actions.ts"
git commit -m "$(cat <<'EOF'
feat(s5): updateTenantProfileAction handles avatar/bio/video w/ sanitize+validate

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: AvatarUploader + VideoInput components

**Files:**
- Create: `src/app/(tenant)/settings/profile/avatar-uploader.tsx`
- Create: `src/app/(tenant)/settings/profile/video-input.tsx`

- [ ] **Step 1: AvatarUploader（直接走 client-side Supabase upload）**

```tsx
// src/app/(tenant)/settings/profile/avatar-uploader.tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

type Props = {
  tenantId: string
  initialUrl: string | null
  onUploaded: (publicUrl: string) => void
  onCleared: () => void
}

const ACCEPT = 'image/jpeg,image/png,image/webp'
const MAX_BYTES = 5 * 1024 * 1024

export default function AvatarUploader({ tenantId, initialUrl, onUploaded, onCleared }: Props) {
  const [pending, start] = useTransition()
  const [url, setUrl] = useState<string | null>(initialUrl)

  function handleFile(file: File) {
    if (!ACCEPT.split(',').includes(file.type)) {
      toast.error('僅接受 JPEG / PNG / WebP')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error('檔案不可超過 5 MB')
      return
    }
    const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
    const path = `${tenantId}/avatar-${Date.now()}.${ext}`
    start(async () => {
      const sb = createSupabaseBrowserClient()
      const { error } = await sb.storage.from('coach-media').upload(path, file, {
        contentType: file.type,
        upsert: true,
      })
      if (error) {
        toast.error(error.message)
        return
      }
      const { data } = sb.storage.from('coach-media').getPublicUrl(path)
      setUrl(data.publicUrl)
      onUploaded(data.publicUrl)
      toast.success('已上傳，記得按下方「儲存」')
    })
  }

  return (
    <div className="space-y-3">
      <Label>大頭照（公開頁顯示）</Label>
      {url ? (
        <div className="flex items-center gap-4">
          <img src={url} alt="" className="h-20 w-20 rounded-full object-cover ring-2 ring-border" />
          <div className="flex flex-col gap-2">
            <Button variant="outline" size="sm" asChild>
              <label className="cursor-pointer">
                更換
                <input
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </label>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setUrl(null)
                onCleared()
              }}
            >
              移除
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" asChild disabled={pending}>
          <label className="cursor-pointer">
            {pending ? '上傳中...' : '選擇圖片'}
            <input
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
        </Button>
      )}
      <p className="text-xs text-muted-foreground">建議 800×800 以上、JPEG/PNG/WebP、單檔 ≤ 5 MB。</p>
    </div>
  )
}
```

- [ ] **Step 2: VideoInput**

```tsx
// src/app/(tenant)/settings/profile/video-input.tsx
'use client'

import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseVideoUrl, VideoEmbed } from '@/components/public-page/video-embed'

type Props = {
  value: string
  onChange: (v: string) => void
}

export default function VideoInput({ value, onChange }: Props) {
  const parsed = useMemo(() => parseVideoUrl(value), [value])
  return (
    <div className="space-y-3">
      <Label htmlFor="introVideo">介紹影片（YouTube 或 Vimeo URL）</Label>
      <Input
        id="introVideo"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://www.youtube.com/watch?v=..."
      />
      {value && !parsed && <p className="text-xs text-destructive">無法辨識的連結（僅支援 YouTube / Vimeo）</p>}
      {parsed && (
        <div className="overflow-hidden rounded-xl border">
          <VideoEmbed url={value} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 跑 typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "src/app/(tenant)/settings/profile/avatar-uploader.tsx" "src/app/(tenant)/settings/profile/video-input.tsx"
git commit -m "$(cat <<'EOF'
feat(s5): AvatarUploader + VideoInput components (settings/profile)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: TipTap BioEditor

**Files:**
- Create: `src/app/(tenant)/settings/profile/bio-editor.tsx`

- [ ] **Step 1: 實作 dynamic-imported TipTap wrapper**

```tsx
// src/app/(tenant)/settings/profile/bio-editor.tsx
'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { Button } from '@/components/ui/button'
import { Bold, Italic, List, ListOrdered, Heading2, Link as LinkIcon } from 'lucide-react'

type Props = {
  value: string
  onChange: (html: string) => void
}

export default function BioEditor({ value, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
    ],
    content: value || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[200px] focus:outline-none p-3',
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  })

  if (!editor) return null

  function promptLink() {
    const url = window.prompt('連結 URL（http:// 或 https://）')
    if (!url) return
    editor!.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex flex-wrap gap-1 border-b bg-muted/30 p-2">
        <Button
          type="button"
          variant={editor.isActive('bold') ? 'default' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="粗體"
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('italic') ? 'default' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="斜體"
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-label="標題"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="項目清單"
        >
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="編號清單"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('link') ? 'default' : 'ghost'}
          size="sm"
          onClick={promptLink}
          aria-label="加連結"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
```

- [ ] **Step 2: 跑 typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "src/app/(tenant)/settings/profile/bio-editor.tsx"
git commit -m "$(cat <<'EOF'
feat(s5): TipTap BioEditor with bold/italic/h2/list/link toolbar

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: PhotoGalleryManager（後台）

**Files:**
- Create: `src/app/(tenant)/settings/profile/photo-gallery-manager.tsx`

- [ ] **Step 1: 實作 manager — client-side upload to Storage, then call addPhotoAction**

```tsx
// src/app/(tenant)/settings/profile/photo-gallery-manager.tsx
'use client'

import { useState, useTransition } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addPhotoAction, updatePhotoCaptionAction, deletePhotoAction } from './photo-actions'

const PHOTO_LIMIT = 10
const ACCEPT = 'image/jpeg,image/png,image/webp'
const MAX_BYTES = 5 * 1024 * 1024

export type PhotoRow = {
  id: string
  storage_path: string
  caption: string | null
  public_url: string
}

type Props = {
  tenantId: string
  photos: PhotoRow[]
}

export default function PhotoGalleryManager({ tenantId, photos }: Props) {
  const [pending, start] = useTransition()
  const addAct = useAction(addPhotoAction, {
    onError: ({ error }) => toast.error(error.serverError?.message ?? '加入失敗'),
    onSuccess: () => toast.success('已加入照片'),
  })
  const captionAct = useAction(updatePhotoCaptionAction, {
    onError: ({ error }) => toast.error(error.serverError?.message ?? '更新失敗'),
    onSuccess: () => toast.success('已儲存說明'),
  })
  const deleteAct = useAction(deletePhotoAction, {
    onError: ({ error }) => toast.error(error.serverError?.message ?? '刪除失敗'),
    onSuccess: () => toast.success('已刪除照片'),
  })

  function uploadFiles(files: FileList | null) {
    if (!files) return
    const remaining = PHOTO_LIMIT - photos.length
    if (remaining <= 0) {
      toast.error(`已達 ${PHOTO_LIMIT} 張上限`)
      return
    }
    const list = Array.from(files).slice(0, remaining)
    start(async () => {
      const sb = createSupabaseBrowserClient()
      for (const file of list) {
        if (!ACCEPT.split(',').includes(file.type)) {
          toast.error(`${file.name}: 僅接受 JPEG/PNG/WebP`)
          continue
        }
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name}: 超過 5 MB`)
          continue
        }
        const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
        const path = `${tenantId}/photo-${crypto.randomUUID()}.${ext}`
        const { error } = await sb.storage.from('coach-media').upload(path, file, {
          contentType: file.type,
          upsert: false,
        })
        if (error) {
          toast.error(`${file.name}: ${error.message}`)
          continue
        }
        addAct.execute({ storagePath: path, caption: null })
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>照片</Label>
        <span className="text-xs text-muted-foreground">
          {photos.length} / {PHOTO_LIMIT}
        </span>
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">尚未上傳照片</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {photos.map((p) => (
            <div key={p.id} className="space-y-2 rounded-lg border bg-card p-2">
              <img src={p.public_url} alt={p.caption ?? ''} className="aspect-square w-full rounded object-cover" />
              <Input
                defaultValue={p.caption ?? ''}
                placeholder="說明（選填）"
                onBlur={(e) => {
                  if (e.target.value !== (p.caption ?? '')) {
                    captionAct.execute({ id: p.id, caption: e.target.value || null })
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => deleteAct.execute({ id: p.id })}
              >
                刪除
              </Button>
            </div>
          ))}
        </div>
      )}

      {photos.length < PHOTO_LIMIT && (
        <Button asChild variant="outline" disabled={pending}>
          <label className="cursor-pointer">
            {pending ? '上傳中...' : '加入照片'}
            <input
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => uploadFiles(e.target.files)}
            />
          </label>
        </Button>
      )}
      <p className="text-xs text-muted-foreground">最多 {PHOTO_LIMIT} 張、單檔 ≤ 5 MB（JPEG/PNG/WebP）。</p>
    </div>
  )
}
```

- [ ] **Step 2: 跑 typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "src/app/(tenant)/settings/profile/photo-gallery-manager.tsx"
git commit -m "$(cat <<'EOF'
feat(s5): PhotoGalleryManager — upload/caption/delete (≤10 photos)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: 後台 page + profile-form 整合所有 sections

**Files:**
- Modify: `src/app/(tenant)/settings/profile/page.tsx`
- Modify: `src/app/(tenant)/settings/profile/profile-form.tsx`

- [ ] **Step 1: page.tsx — query 新欄位 + photos**

```tsx
// src/app/(tenant)/settings/profile/page.tsx
import { redirect } from 'next/navigation'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCoachMediaPublicUrl } from '@/lib/storage'
import ProfileForm from './profile-form'

export default async function TenantProfilePage() {
  const session = await requireTenantMember()
  if (session.role !== 'tenant_owner') redirect('/dashboard')

  const supabase = await createSupabaseServerClient()
  const [{ data: tenant }, { data: photoRows }] = await Promise.all([
    supabase
      .from('tenants')
      .select(
        'name, description, contact_email, contact_phone, contact_line_id, contact_note, avatar_url, bio_html, intro_video_url',
      )
      .eq('id', session.tenantId)
      .single(),
    supabase
      .from('tenant_photos')
      .select('id, storage_path, caption')
      .eq('tenant_id', session.tenantId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  if (!tenant) redirect('/dashboard')

  const photos = (photoRows ?? []).map((p) => ({
    id: p.id,
    storage_path: p.storage_path,
    caption: p.caption,
    public_url: getCoachMediaPublicUrl(p.storage_path),
  }))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl tracking-tight">
          <span className="italic">租戶資料</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">公開頁顯示的名稱、介紹、媒體與聯絡方式</p>
      </header>

      <ProfileForm tenantId={session.tenantId} initial={tenant} photos={photos} />
    </div>
  )
}
```

- [ ] **Step 2: profile-form.tsx — sections 重組 + 加 AvatarUploader / BioEditor / VideoInput / PhotoGalleryManager**

```tsx
// src/app/(tenant)/settings/profile/profile-form.tsx
'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateTenantProfileAction } from './actions'
import AvatarUploader from './avatar-uploader'
import BioEditor from './bio-editor'
import VideoInput from './video-input'
import PhotoGalleryManager, { type PhotoRow } from './photo-gallery-manager'

type Profile = {
  name: string
  description: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_line_id: string | null
  contact_note: string | null
  avatar_url: string | null
  bio_html: string | null
  intro_video_url: string | null
}

export default function ProfileForm({
  tenantId,
  initial,
  photos,
}: {
  tenantId: string
  initial: Profile
  photos: PhotoRow[]
}) {
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description ?? '')
  const [contactEmail, setContactEmail] = useState(initial.contact_email ?? '')
  const [contactPhone, setContactPhone] = useState(initial.contact_phone ?? '')
  const [contactLineId, setContactLineId] = useState(initial.contact_line_id ?? '')
  const [contactNote, setContactNote] = useState(initial.contact_note ?? '')
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url ?? '')
  const [bioHtml, setBioHtml] = useState(initial.bio_html ?? '')
  const [introVideoUrl, setIntroVideoUrl] = useState(initial.intro_video_url ?? '')

  const { execute, isPending } = useAction(updateTenantProfileAction, {
    onSuccess: () => toast.success('已儲存'),
    onError: ({ error }) => toast.error(error.serverError?.message ?? '失敗'),
  })

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault()
        execute({
          name,
          description: description || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          contactLineId: contactLineId || null,
          contactNote: contactNote || null,
          avatarUrl: avatarUrl || null,
          bioHtml: bioHtml || null,
          introVideoUrl: introVideoUrl || null,
        })
      }}
    >
      <section className="space-y-4">
        <h2 className="font-display text-xl">基本資料</h2>
        <div className="space-y-2">
          <Label htmlFor="name">租戶名稱（公開顯示）</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">一句介紹（hero 副標）</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例如：10 年桌球教學經驗，國手級指導..."
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl">Hero 大頭照</h2>
        <AvatarUploader
          tenantId={tenantId}
          initialUrl={avatarUrl || null}
          onUploaded={setAvatarUrl}
          onCleared={() => setAvatarUrl('')}
        />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl">完整介紹（Bio）</h2>
        <p className="text-xs text-muted-foreground">支援粗體 / 斜體 / 標題 / 清單 / 連結。儲存時會做 HTML 過濾。</p>
        <BioEditor value={bioHtml} onChange={setBioHtml} />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl">介紹影片</h2>
        <VideoInput value={introVideoUrl} onChange={setIntroVideoUrl} />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl">照片</h2>
        <PhotoGalleryManager tenantId={tenantId} photos={photos} />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl">聯絡方式（公開顯示）</h2>
        <p className="text-xs text-muted-foreground">填的欄位會在你的公開預約頁顯示給學員。沒填的會隱藏。</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">電話</Label>
            <Input id="phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="line">LINE ID</Label>
            <Input id="line" value={contactLineId} onChange={(e) => setContactLineId(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">備註</Label>
            <Input id="note" value={contactNote} onChange={(e) => setContactNote(e.target.value)} />
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 -mx-6 border-t bg-background/95 px-6 py-4 backdrop-blur">
        <Button type="submit" disabled={isPending} size="lg">
          {isPending ? '儲存中...' : '儲存所有變更'}
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: 跑 typecheck + dev 一次手動驗收**

Run: `npm run typecheck`
Expected: PASS

Then run: `npm run dev`，前往 `/settings/profile`，確認 5 個 sections 都渲染、上傳一張 avatar、輸入 bio、貼 YouTube URL、上傳 1 張照片、按儲存 → toast「已儲存」、reload 後內容仍在。

- [ ] **Step 4: Commit**

```bash
git add "src/app/(tenant)/settings/profile/page.tsx" "src/app/(tenant)/settings/profile/profile-form.tsx"
git commit -m "$(cat <<'EOF'
feat(s5): /settings/profile sections — avatar/bio/video/photos integrated

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: 公開頁 components — BioBlock / PhotoGallery / AuthCta

**Files:**
- Create: `src/components/public-page/bio-block.tsx`
- Create: `src/components/public-page/photo-gallery.tsx`
- Create: `src/components/public-page/auth-cta.tsx`

- [ ] **Step 1: BioBlock（trusted sanitized HTML）**

```tsx
// src/components/public-page/bio-block.tsx
export default function BioBlock({ html }: { html: string | null | undefined }) {
  if (!html || !html.trim()) return null
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">關於</h2>
      <article
        className="prose prose-sm max-w-none prose-headings:font-display prose-a:text-primary"
        // bio_html 已在 server 端 sanitize-html 過濾，DB 內容受信任
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  )
}
```

- [ ] **Step 2: PhotoGallery**

```tsx
// src/components/public-page/photo-gallery.tsx
type Photo = { id: string; public_url: string; caption: string | null }

export default function PhotoGallery({ photos }: { photos: Photo[] }) {
  if (photos.length === 0) return null
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">環境 / 照片</h2>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {photos.map((p) => (
          <figure key={p.id} className="group overflow-hidden rounded-xl border bg-card">
            <img
              src={p.public_url}
              alt={p.caption ?? ''}
              loading="lazy"
              className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {p.caption && (
              <figcaption className="border-t px-3 py-2 text-xs text-muted-foreground">{p.caption}</figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: AuthCta**

```tsx
// src/components/public-page/auth-cta.tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AuthCta({ returnPath }: { returnPath: string }) {
  const enc = encodeURIComponent(returnPath)
  return (
    <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
      <p className="font-medium text-amber-900">尚未登入</p>
      <p className="mt-1 text-amber-800">登入或註冊後即可購買套裝 / 預約時段。</p>
      <div className="mt-3 flex gap-2">
        <Button asChild size="sm">
          <Link href={`/login?redirect=${enc}`}>登入</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/signup?redirect=${enc}`}>註冊</Link>
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 跑 typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/public-page/bio-block.tsx src/components/public-page/photo-gallery.tsx src/components/public-page/auth-cta.tsx
git commit -m "$(cat <<'EOF'
feat(s5): public-page components — BioBlock + PhotoGallery + AuthCta

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: 公開頁 `/[tenantSlug]/page.tsx` 整合 avatar / bio / video / gallery / AuthCta

**Files:**
- Modify: `src/app/[tenantSlug]/page.tsx`

- [ ] **Step 1: query photos + session、改 hero、加 sections**

修改 `src/app/[tenantSlug]/page.tsx` — 在現有 imports 加入新 components 與 `getSession`：

```tsx
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Clock, DollarSign, Mail, Phone, MessageCircle } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getTenantBySlug } from '@/lib/auth/get-tenant-context'
import { getSession } from '@/lib/auth/get-session'
import { getCoachMediaPublicUrl } from '@/lib/storage'
import { VideoEmbed } from '@/components/public-page/video-embed'
import BioBlock from '@/components/public-page/bio-block'
import PhotoGallery from '@/components/public-page/photo-gallery'
import AuthCta from '@/components/public-page/auth-cta'
import SlotPicker from './slot-picker'
```

在 `if (tenant.status === 'suspended')` block 之後、`const supabase = ...` 之前、添加 photos + session query：

```tsx
const supabase = await createSupabaseServerClient()
const [{ data: services }, { data: photoRows }, session] = await Promise.all([
  supabase
    .from('services')
    .select('id, name, description, duration_minutes, price')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('name'),
  supabase
    .from('tenant_photos')
    .select('id, storage_path, caption')
    .eq('tenant_id', tenant.id)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true }),
  getSession(),
])

const photos = (photoRows ?? []).map((p) => ({
  id: p.id,
  public_url: getCoachMediaPublicUrl(p.storage_path),
  caption: p.caption,
}))
const isStudentVisitor = !session || session.role === 'customer' || session.role === 'anonymous'
const returnPath = `/${tenantSlug}`
```

修改 hero block — 在現有 `<div className="relative">` 內部、`<h1>` 前加 avatar inset；在現有 contact links 之後加 AuthCta：

```tsx
<div className="relative">
  <div className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-60">
    預約 · /{tenant.slug}
  </div>
  {tenant.avatar_url && (
    <img
      src={tenant.avatar_url}
      alt=""
      className="mt-4 h-20 w-20 rounded-full object-cover ring-2 ring-background/40"
    />
  )}
  <h1 className="mt-4 font-display text-5xl leading-[0.95] tracking-tight sm:text-6xl">
    <span className="italic">{tenant.name}</span>
  </h1>
  <p className="mt-6 max-w-md text-sm leading-relaxed text-background/75">
    {tenant.description?.trim() ||
      '在下方選擇您想預訂的服務、日期與時段。送出後狀態為「待確認」，教練確認後即正式成立。'}
  </p>
  {(tenant.contact_email || tenant.contact_phone || tenant.contact_line_id || tenant.contact_note) && (
    <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-background/80">
      {/* ... 既有 contact links 不動 ... */}
    </div>
  )}
  {isStudentVisitor && !session && <AuthCta returnPath={returnPath} />}
</div>
```

在 `{rescheduleFrom && (...)}` block **之前**（即 hero `</header>` 之後、reschedule banner 之前）插入新 sections：

```tsx
</header>

<BioBlock html={tenant.bio_html} />

{tenant.intro_video_url && (
  <section className="mt-8">
    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">介紹影片</h2>
    <VideoEmbed url={tenant.intro_video_url} />
  </section>
)}

<PhotoGallery photos={photos} />

{rescheduleFrom && (
  /* ... 既有 reschedule banner 不動 ... */
)}
```

- [ ] **Step 2: 跑 typecheck + 視覺驗收**

Run: `npm run typecheck`

Then `npm run dev`：前往 `/demo-lin-coach`（或當前 seed 的 slug），確認 hero 有 avatar inset（如有資料）、Bio HTML 正常渲染（粗體有效）、影片 iframe 載入、photos grid 顯示、未登入時看到 AuthCta。

- [ ] **Step 3: Commit**

```bash
git add "src/app/[tenantSlug]/page.tsx"
git commit -m "$(cat <<'EOF'
feat(s5): public page hero avatar + bio + video + gallery + auth CTA (FR-131/132/133/134/136)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: `/[tenantSlug]/packages/page.tsx` 加 AuthCta

**Files:**
- Modify: `src/app/[tenantSlug]/packages/page.tsx`

- [ ] **Step 1: 加 getSession + AuthCta（在 header 區下方）**

在 imports 加：

```tsx
import { getSession } from '@/lib/auth/get-session'
import AuthCta from '@/components/public-page/auth-cta'
```

把 `const supabase = await createSupabaseServerClient()` 後 services / packages 抓取改為與 session 並行：

```tsx
const supabase = await createSupabaseServerClient()
const [{ data: services }, session] = await Promise.all([
  supabase
    .from('services')
    .select('id, name, description, duration_minutes')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('name'),
  getSession(),
])
```

在 hero header `<p className="mt-1 ...">` 之後加：

```tsx
{(!session || session.role === 'customer' || session.role === 'anonymous') && !session && (
  <AuthCta returnPath={`/${tenantSlug}/packages`} />
)}
```

- [ ] **Step 2: 跑 typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "src/app/[tenantSlug]/packages/page.tsx"
git commit -m "$(cat <<'EOF'
feat(s5): packages page shows AuthCta when unauthenticated (FR-136)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 19: signup action — `redirectTo` + open-redirect 防護 + auto-login

**Files:**
- Modify: `src/app/(auth)/signup/actions.ts`
- Modify: `src/app/(auth)/signup/page.tsx`
- Modify: `src/app/(auth)/login/actions.ts`

- [ ] **Step 1: signup actions.ts**

```ts
// src/app/(auth)/signup/actions.ts
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
  inviteToken: z.string().optional(),
  redirectTo: z.string().optional(),
})

function safePath(path: string | undefined | null): string {
  if (!path) return '/'
  // Must be an internal absolute path; block protocol-relative URLs ("//evil.com")
  if (!path.startsWith('/') || path.startsWith('//')) return '/'
  return path
}

export const signupAction = actionClient.inputSchema(SignupSchema).action(async ({ parsedInput }) => {
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

  // Invite token branch — keep existing flow (login → invite)
  if (parsedInput.inviteToken) {
    redirect(`/login?redirect=/invite/${parsedInput.inviteToken}`)
  }

  const target = safePath(parsedInput.redirectTo)

  // If Supabase auto-signed-in (no email confirmation required), redirect to target directly
  if (data.session) {
    redirect(target)
  }

  // Otherwise show login with signedup banner + carry redirect through
  redirect(`/login?signedup=1&redirect=${encodeURIComponent(target)}`)
})
```

- [ ] **Step 2: signup page.tsx — forward `?redirect=` 給 action**

替換 SignupForm body 中 form onSubmit 的呼叫；在 component 內部新增 `const redirectTo = params.get('redirect')`：

```tsx
function SignupForm() {
  const params = useSearchParams()
  const inviteToken = params.get('invite')
  const redirectTo = params.get('redirect')
  const presetEmail = params.get('email') ?? ''
  // ... rest unchanged
}
```

並把 `execute({ email, password, displayName, inviteToken: inviteToken ?? undefined })` 改成：

```tsx
execute({
  email,
  password,
  displayName,
  inviteToken: inviteToken ?? undefined,
  redirectTo: redirectTo ?? undefined,
})
```

- [ ] **Step 3: login actions.ts — safePath 防 open-redirect**

```ts
// src/app/(auth)/login/actions.ts
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

function safePath(path: string | undefined | null): string {
  if (!path) return '/'
  if (!path.startsWith('/') || path.startsWith('//')) return '/'
  return path
}

export const loginAction = actionClient.inputSchema(LoginSchema).action(async ({ parsedInput }) => {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsedInput.email,
    password: parsedInput.password,
  })
  if (error) throw new AppError('AUTH_FAILED', '帳號或密碼錯誤')
  redirect(safePath(parsedInput.redirectTo))
})
```

- [ ] **Step 4: 跑 typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: 手動驗收**

`npm run dev` 後：
1. 在無痕視窗開 `/demo-lin-coach`
2. 點 slot → 應被 `/book/...` 擋到 `/login?redirect=...`
3. 點「建立帳號」連到 `/signup` — **但 redirect 未自動帶**（signup link 目前在 login form 是硬 link `/signup`，所以這步看不出）。直接打 `/signup?redirect=/book/X` 測：填表 → 註冊成功 →
   - 若 Supabase 專案不要求 email 確認：直接 land on `/book/X`
   - 若要求：被導去 `/login?signedup=1&redirect=%2Fbook%2FX`，登入後 land on `/book/X`
4. 試 `?redirect=https://evil.com` → 應 fallback 到 `/`
5. 試 `?redirect=//evil.com` → 應 fallback 到 `/`

- [ ] **Step 6: Commit**

```bash
git add "src/app/(auth)/signup/actions.ts" "src/app/(auth)/signup/page.tsx" "src/app/(auth)/login/actions.ts"
git commit -m "$(cat <<'EOF'
feat(s5): signup/login redirect param + open-redirect guard + auto-login (FR-135)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 20: Seed update — 林教練 avatar + bio + video + 2 photos

**Files:**
- Modify: `scripts/seed-test-data.mjs`

- [ ] **Step 1: 在 seed 林教練 tenant 處添加 demo media**

打開 `scripts/seed-test-data.mjs`，找到建立林教練 tenant 的區塊（搜尋 "林教練" 或 demo slug），在 `tenants.upsert` 或 `update` 增加：

```js
// 在既有 tenant upsert 之後（或合併進去）
await supabase
  .from('tenants')
  .update({
    avatar_url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&h=400&fit=crop',
    bio_html:
      '<h2>關於我</h2><p>10 年桌球教學經驗，<strong>國手級指導</strong>。專長從基本動作矯正到比賽戰術設計。</p><ul><li>業餘國手 5 年</li><li>桌球教練 C 級證照</li><li>北市青少年盃金牌教練</li></ul>',
    intro_video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  })
  .eq('id', linCoachTenantId)

// Photo seeds — 2 張示意（用 Unsplash 公開連結，模擬 user 上傳後落在 coach-media bucket 中的 row）
// 注意：seed 環境如未上傳實體檔，可直接 insert row + storage_path 指向 demo path；公開頁仍能讀 row。
//      若需要 image 可顯示，可改插入 external URL 到 caption 並改 PhotoGallery 接受外部 URL，
//      但為了符合 schema、這裡 storage_path 用 demo path、image 顯示需手動上傳。
await supabase.from('tenant_photos').upsert(
  [
    {
      tenant_id: linCoachTenantId,
      storage_path: `${linCoachTenantId}/demo-court-1.jpg`,
      caption: '主場館 — 8 張球桌',
      display_order: 0,
    },
    {
      tenant_id: linCoachTenantId,
      storage_path: `${linCoachTenantId}/demo-court-2.jpg`,
      caption: '訓練區',
      display_order: 1,
    },
  ],
  { onConflict: 'id' },
)
```

> **Note for executor:** 若 seed 機制有 idempotency key（不是 id），改用對應 unique key；以實際 seed 腳本既有 pattern 為準。`linCoachTenantId` 變數名以實際變數為準。

- [ ] **Step 2: 跑 seed**

Run: `node scripts/seed-test-data.mjs`
Expected: 完成、無錯誤

- [ ] **Step 3: 視覺驗收**

`npm run dev` → 開 `/<lin-coach-slug>` → 應看到：
- Hero avatar inset（Unsplash 大頭照）
- Bio block — 「關於我」標題 + 粗體有效 + ul 列表
- YouTube 影片 iframe
- 2 個 photo grid（圖片可能 broken，因 storage 無實體檔，但 caption 應顯示）

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-test-data.mjs
git commit -m "$(cat <<'EOF'
feat(s5): seed 林教練 avatar + bio + video + 2 photos demo

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 21: README + spec 附錄 C 更新

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md`

- [ ] **Step 1: README — 加三節**

打開 `README.md`，在合適位置（介紹完功能模組後）加：

```markdown
### 教練介紹頁

教練在 `/settings/profile` 可以維護：
- **大頭照**（avatar_url，hero 顯示）
- **完整 bio**：TipTap 編輯器，支援粗體/斜體/標題/清單/連結；存檔前用 `sanitize-html` 過濾
- **介紹影片**：貼 YouTube / Vimeo URL，公開頁以 iframe 嵌入（不接受其他來源）
- **照片 gallery**：最多 10 張（JPEG/PNG/WebP，單檔 ≤ 5 MB），存 `coach-media` Storage bucket

公開頁 `/<slug>` 自動顯示這些資訊。`tenants.avatar_url`/`bio_html`/`intro_video_url` 與 `tenant_photos` table。

### Storage bucket `coach-media`

由 migration `20260526100003_storage_coach_media_bucket.sql` 建立：
- `public: true`（URL 直接可讀）
- 5 MB 上限、僅 image/jpeg、image/png、image/webp
- RLS：路徑第一段必須是 caller 的 owner tenant_id（用 `current_user_owner_tenant_ids()` helper）

### Auth flow（含 redirect 處理）

- `/login` 與 `/signup` 都接受 `?redirect=<path>`（必須以 `/` 開頭、不能 `//`，否則 fallback `/`）
- `/book/[slotId]` 未登入時被 layout 擋下、redirect 帶到 `/login?redirect=/book/X`
- `/signup` 註冊成功：
  - 若 Supabase 不要求 email 確認（auto-signin），直接 redirect 到 `redirect` target
  - 若要求 email 確認，redirect 到 `/login?signedup=1&redirect=...`，登入後到 target
- 公開頁 `/<slug>` 與 `/<slug>/packages` 未登入時顯示 `AuthCta`，按鈕帶 `redirect=current_url`
```

- [ ] **Step 2: spec 附錄 C — 加 FR-131~136**

打開 `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md`，找到附錄 C 結尾（前面是 FR-125~130），append：

```markdown
### S5 — 教練介紹頁 + 學員登入流程（commit: <FILL_AFTER_FINAL_COMMIT>）

- **FR-131 Hero cover image**：wire `tenants.avatar_url`、後台 AvatarUploader、公開頁 hero 圓形 inset
- **FR-132 照片 gallery**：新 `tenant_photos` 表、`coach-media` Storage bucket、後台 PhotoGalleryManager（上限 10 張）、公開頁 PhotoGallery
- **FR-133 Intro video URL**：`tenants.intro_video_url`、`parseVideoUrl` 解析 YouTube/Vimeo、VideoEmbed iframe
- **FR-134 Bio rich text**：`tenants.bio_html`、TipTap BioEditor（粗/斜/H2/list/link）、`sanitize-html` 過濾、BioBlock 渲染
- **FR-135 Signup 保留 `?redirect=`**：signup action 加 redirectTo + open-redirect 防護（`safePath`）+ 若 session 已建（auto-signin）直接 redirect
- **FR-136 公開頁未登入 CTA**：`/<slug>` 與 `/<slug>/packages` 顯示 AuthCta、帶 `redirect=<current_url>`

新 migration（4）：tenants_intro_columns、tenant_photos_schema、tenant_photos_rls、storage_coach_media_bucket。新依賴：`@tiptap/react`、`@tiptap/starter-kit`、`@tiptap/extension-link`、`sanitize-html`、`@types/sanitize-html`。
```

- [ ] **Step 3: Commit**

```bash
git add README.md docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md
git commit -m "$(cat <<'EOF'
docs(s5): README intro page/storage/auth sections + spec appendix C FR-131~136

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: 將 commit hash 回填**

`git log --oneline -1` 取最新 commit hash、編輯附錄 C 把 `<FILL_AFTER_FINAL_COMMIT>` 換成該 hash、再 commit：

```bash
git add docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md
git commit -m "$(cat <<'EOF'
docs(s5): backfill commit hash in spec appendix C

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 22: Final verification + push

**Files:** N/A

- [ ] **Step 1: 全面 verify**

Run（並行 OK）：

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

Expected: 全部 PASS。如 build 報 warning 屬於 TipTap dynamic-only 不影響可忽略；如 error 須先修。

- [ ] **Step 2: 手動驗收 spec §2.3 驗收 gate**

`npm run dev` 後逐項：
- [ ] /settings/profile：上傳 cover image → toast 「已儲存」（按 form submit）
- [ ] BioEditor：粗體/斜體/H2/list 切換有效、儲存後 reload 仍在
- [ ] VideoInput：貼 YouTube URL → preview iframe 顯示
- [ ] PhotoGalleryManager：上傳 3 張、看到 3/10 計數、刪除一張 → 2/10、改 caption blur 後 toast
- [ ] /demo-lin-coach 或對應 slug：hero avatar inset、Bio prose、影片 iframe、photo gallery
- [ ] 無痕視窗 /demo-lin-coach：看到 AuthCta（黃 box + 登入/註冊 按鈕）
- [ ] /demo-lin-coach/packages 無痕：看到 AuthCta
- [ ] 未登入點 slot → /book/X → /login?redirect=%2Fbook%2FX → 點「建立帳號」 → 註冊成功 → land on /book/X
- [ ] 試 /login?redirect=https://evil.com 直接登入後 → 應 fallback 到 `/`
- [ ] /login?redirect=//evil.com → fallback `/`

- [ ] **Step 3: Push**

```bash
git push origin master
```

- [ ] **Step 4: 等 Vercel READY**

開 Vercel dashboard / `vercel inspect <url>`，等 latest deployment 狀態為 READY。如 build error 立即修。

- [ ] **Step 5: 完成 — 通知使用者**

回報：「S5 完成、X commits 已 push、Vercel READY、verify gate 全過。下一步可進 S6（主題色/字型 + 架構/資安 review）」。

---

## Self-Review

**Spec coverage check:**

| Spec § | 內容 | Task 對應 |
|---|---|---|
| §2.1 FR-131 Hero cover image | wire avatar_url | Task 6 (types/getTenantBySlug)、Task 11 (action)、Task 12 (uploader)、Task 17 (public page hero) |
| §2.1 FR-132 照片 gallery | tenant_photos 表 + bucket + ≤10 | Task 3/4/5 (migrations)、Task 9/10 (storage + actions)、Task 14 (manager)、Task 16/17 (public PhotoGallery) |
| §2.1 FR-133 Intro video | 解析 YT/Vimeo + iframe | Task 8 (parseVideoUrl + VideoEmbed)、Task 11 (validate)、Task 12 (VideoInput)、Task 17 (public render) |
| §2.1 FR-134 Bio rich text | TipTap + sanitize + render | Task 1 (deps)、Task 2 (column)、Task 7 (sanitize)、Task 11 (action sanitize)、Task 13 (BioEditor)、Task 16 (BioBlock)、Task 17 (public render) |
| §2.1 FR-135 Signup `?redirect=` | redirectTo + auto-login | Task 19 |
| §2.1 FR-136 公開頁 CTA | AuthCta on /[slug] + /[slug]/packages | Task 16 (component)、Task 17 + 18 (integrate) |
| §3.1 tenants 新欄位 | bio_html + intro_video_url | Task 2 |
| §3.2 tenant_photos 表 | schema + index | Task 3 |
| §3.3 RLS | tenant_photos policies | Task 4 |
| §3.4 Storage bucket | coach-media + RLS | Task 5 |
| §4.1 後台改造 | sections | Task 15 |
| §4.2 公開頁 layout | hero + bio + video + gallery | Task 17 |
| §4.3 video URL 解析 | parseVideoUrl TDD ≥6 cases | Task 8（7 cases，含 empty / unknown / malformed） |
| §4.4 Bio sanitization | sanitize-html lib | Task 7 (含 9 test cases) |
| §4.5 TipTap wrapper | StarterKit + Link | Task 13 |
| §4.6 Photo upload flow | client upload + addPhotoAction | Task 14 |
| §4.7 公開頁 not-logged-in CTA | AuthCta | Task 16 |
| §5.1 signupAction | redirectTo + auto-login + email-confirm fallback | Task 19 |
| §5.2 /login form 支援 redirect | 既有，加 safePath | Task 19 |
| §5.3 Open-redirect 防護 | safePath in both actions | Task 19 |
| §6 Files | 全部 Create / Modify | Task 1~21 全覆蓋 |
| §7 風險 | 緩解策略 | Task 8 (regex whitelist)、Task 7 (sanitize)、Task 19 (safePath)、Task 4/5 (RLS) |
| §8 doc 更新 | README + 附錄 C | Task 21 |

**Placeholder scan:** 無 TBD / TODO / 「similar to」/ 「fill in」/ 「add appropriate」。所有 code blocks 完整。

**Type consistency check:**
- `PhotoRow` 型別在 Task 14 定義、Task 15 import & 用同名 — OK
- `ParsedVideo` 在 Task 8 定義、Task 12 透過 `parseVideoUrl` 使用 — OK
- `getCoachMediaPublicUrl` 在 Task 9 export、Task 15 + 17 import 同名 — OK
- `safePath` 在 Task 19 兩個 action 各自定義（local helper）— OK，避免新增 shared util 增加 surface
- TipTap：BioEditor 內部使用 StarterKit + Link，Task 13；deps 在 Task 1 安裝 — OK

無問題。

---

## Execution Handoff

Plan 已存到 `docs/superpowers/plans/2026-05-27-s5-coach-page-and-auth.md`。共 **22 個 task**（含 final verify + push）。

兩種執行方式：

**1. Subagent-Driven（建議，與 S2~S4 同模式）** — 每個 task 派新 sonnet subagent 實作 + spec reviewer + code quality reviewer，主 session 在 checkpoint 之間 review

**2. Inline Execution** — 在當前 session batch 執行，遇 checkpoint 才停

要走哪個？
