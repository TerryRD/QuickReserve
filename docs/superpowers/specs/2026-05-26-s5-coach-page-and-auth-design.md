# S5 — 教練介紹頁 + 學員登入流程釐清設計文件

**建立日期**：2026-05-26
**狀態**：草稿（待使用者複審）
**作者**：terry@webplus.com.tw（透過 brainstorming skill 共同產出）
**Parent spec**：[`2026-05-21-quickreserve-redesign-design.md`](2026-05-21-quickreserve-redesign-design.md)（FR-131~136 將回寫到附錄 C）
**前置子專案**：S1~S4（最後 commit `f18840c`）

---

## 1. 背景

S1~S4 把 bug、效能、可用時段、商品模型都做好了，但學員端體驗仍有兩個關鍵缺口：

1. **教練介紹頁太單薄** — 公開頁 `/[tenantSlug]` 只有 hero（純色 + 名字 + 一句 description）+ 聯絡方式 + 服務 + slot picker。學員無法看到教練長相、教學風格、設施環境、過往評價。`tenants.avatar_url` 欄位在 S0 schema 加了卻從未 wire 起來。
2. **學員登入流程斷掉** — 學員 click slot → /book/[slotId]（未登入會被擋）→ /login → 註冊（去 /signup）→ ... 之後就回不去原本要預約的那個 slot。`?redirect=` 在 /signup 沒處理。

兼顧視覺改造與 auth 修補，本子專案處理這兩件。

---

## 2. 範圍

### 2.1 In scope

**教練介紹頁（FR-131~134）：**
- **FR-131**：Hero cover image — wire 既有 `tenants.avatar_url`、後台上傳器、公開頁 hero 顯示
- **FR-132**：照片 gallery — 上限 10 張、新表 `tenant_photos`、Supabase Storage bucket、後台 upload/delete/caption、公開頁 grid 呈現
- **FR-133**：Intro video URL — `tenants.intro_video_url`、僅 YouTube/Vimeo whitelisted、後台 input + preview、公開頁 iframe 嵌入
- **FR-134**：Bio rich text — `tenants.bio_html`、TipTap 編輯器（粗體 / 斜體 / list / heading 工具列）、儲存 sanitize-html 處理後 HTML、公開頁 `dangerouslySetInnerHTML` + tailwind typography

**學員登入流程（FR-135~136）：**
- **FR-135**：`/signup` 取 `?redirect=` 參數、註冊成功後 auto-login（若 Supabase project 不要求 email confirmation）+ redirect 回原頁；若要求 confirmation，把 redirect 透過 email link query 帶回
- **FR-136**：`/[slug]` + `/[slug]/packages` hero 區、學員未登入時顯示「登入購買 / 預約」CTA、按鈕帶 `?redirect=<current_url>`

### 2.2 Out of scope（明確排除）

- **影片上傳**（只接 URL 嵌入，不存實體影片）
- **多區塊 bio**（單一 rich text block；不分 credentials / philosophy 等）
- **Magic link / OTP / 重設密碼自製 UI**（用 Supabase 預設）
- **照片 drag-reorder**（建立順序即可、附 delete 按鈕；reorder 是 polish）
- **教練介紹頁主題色客製化**（S6 設計系統做）
- **影片 / 照片 batch import**（手動逐一上傳）
- **學員端「我所有教練」聚合頁**（學員只在各教練的公開頁進出）

### 2.3 成功標準（驗收 gate）

1. 教練於 `/settings/profile`：
   - 上傳 cover image，預覽 + 「已儲存」toast
   - 在 TipTap 編輯 bio、儲存後重新整理仍見內容
   - 加 YouTube URL，preview 顯示嵌入
   - 上傳 3 張照片，gallery 顯示 + 可刪除單張
   - 計數 「3 / 10」 出現
2. 公開頁 `/[slug]`：
   - Hero 顯示 avatar inset 圓圖
   - Bio block 渲染 rich text（粗體有效）
   - 影片 iframe 載入（YouTube）
   - Photo gallery 顯示 3 張、點圖可放大（或至少有 hover state）
   - 未登入時 hero 下方顯示「登入購買 / 預約」CTA 兩個按鈕
3. 學員流：
   - 訪客點 slot → /book/X → /login?redirect=/book/X → /signup?redirect=/book/X
   - 註冊成功 → 直接 land on /book/X（不必再手動 login）
4. 林教練 seed 內：avatar + bio + 1 video + 2 photos demo 都可在 `/demo-lin-coach` 看到

### 2.4 非目標

- 影片秒級控制、播放統計
- Bio 多語系
- 教練介紹頁 SEO meta tags（`og:image`、`twitter:image`）— 可後續加
- 自訂 hero 漸層顏色

---

## 3. 資料模型

### 3.1 `tenants` 新增 2 欄

```sql
alter table public.tenants
  add column bio_html text,
  add column intro_video_url text;
```

`avatar_url` 已存在於 schema、不變。

### 3.2 `tenant_photos` 新表

```sql
create table public.tenant_photos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  storage_path text not null,
  caption text,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_tenant_photos_tenant_order
  on public.tenant_photos(tenant_id, display_order);
```

`storage_path` 格式：`<tenant_id>/<random_uuid>.<ext>`（不含 bucket 名稱、bucket 是 `coach-media`、由 application code 組）。

### 3.3 RLS

`tenant_photos`：
- `SELECT`: public（與 services 同模式）
- `INSERT / UPDATE / DELETE`: tenant_owner only（owner check）+ platform_admin

10 張上限不在 schema CHECK（跨 row 限制 PG 不支援單欄 check），在 server action `createPhotoAction` 內 `count(*) where tenant_id = ? < 10` 驗證後才插入。

### 3.4 Storage bucket

新 bucket `coach-media`:
- `public: true`（無需 auth 即可取 file URL）
- File size limit: 5 MB
- 允許 MIME: `image/jpeg`, `image/png`, `image/webp`

Bucket 與 RLS 透過 SQL migration 建立：

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'coach-media',
  'coach-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- RLS on storage.objects (Supabase 內建表)
create policy coach_media_select_public on storage.objects for select
  using (bucket_id = 'coach-media');

create policy coach_media_write_owner on storage.objects for insert
  with check (
    bucket_id = 'coach-media'
    and (storage.foldername(name))[1]::uuid in (
      select current_user_owner_tenant_ids()
    )
  );

create policy coach_media_update_owner on storage.objects for update
  using (
    bucket_id = 'coach-media'
    and (storage.foldername(name))[1]::uuid in (
      select current_user_owner_tenant_ids()
    )
  );

create policy coach_media_delete_owner on storage.objects for delete
  using (
    bucket_id = 'coach-media'
    and (storage.foldername(name))[1]::uuid in (
      select current_user_owner_tenant_ids()
    )
  );
```

`storage.foldername(name)` 是 Supabase 內建 function、回傳路徑 segments 陣列；第 1 段（index 1，PG 1-based）即 `<tenant_id>`。把它 cast 為 uuid 後比對 owner 的 tenants。

---

## 4. 教練介紹頁 UI

### 4.1 後台 `/settings/profile` 改造

頁面分段重組：

```
租戶資料
├─ 基本資訊（既有：name、description 短一句、slug 唯讀）
├─ Hero
│   └─ Cover Image（avatar_url）— 上傳器 + preview + 刪除
├─ Bio
│   └─ TipTap 編輯器
│       工具列：H1 / H2 / paragraph / bold / italic / bullet list / numbered list / link
├─ 影片
│   ├─ Video URL input
│   └─ 即時 preview iframe（合法 URL 才顯示）
├─ 照片
│   ├─ 多檔上傳器（限 5 MB、限 jpeg/png/webp）
│   ├─ 既有 gallery（3 cols grid，每張可改 caption / 刪除）
│   └─ 「3 / 10」計數
└─ 聯絡資訊（既有：email / phone / line / note）
```

各 section 各自有獨立儲存 / 即時 commit（避免一筆 form 太大、且 photo upload 本來就是 per-photo）。

### 4.2 公開頁 `/[tenantSlug]/page.tsx` 改造

新 layout：

```
┌─ Hero（既有 editorial 風格保留）
│   ├─ avatar inset（左上、圓形、80×80px 含 ring）
│   ├─ 大標 tenant.name
│   ├─ tenant.description（subtitle，純文字）
│   ├─ Contact links（既有 mailto / tel / LINE）
│   └─ 學員未登入 → 「登入購買 / 預約」+ 「註冊」CTA（FR-136）
├─ Bio section（若 bio_html 非空）
│   └─ <article className="prose"> 注入 sanitized HTML
├─ Intro video（若 intro_video_url 合法）
│   └─ <iframe src="https://www.youtube.com/embed/<id>"> 16:9 ratio
├─ 照片 gallery（若 tenant_photos 非空）
│   └─ Grid: 1 col on mobile, 2 sm, 3 md
├─ 服務選擇（既有）
└─ SlotPicker（既有，S2 加的 client component）
```

照片 lightbox 不在 scope；點圖只放大（CSS hover-scale 或 modal — 先用 hover-scale）。

### 4.3 video URL 解析

新 `src/components/public-page/video-embed.tsx`:

```tsx
// 純 client-safe parsing
export function parseVideoUrl(url: string): { provider: 'youtube' | 'vimeo'; id: string } | null {
  // YouTube: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (yt) return { provider: 'youtube', id: yt[1]! }
  // Vimeo: vimeo.com/123456789
  const vm = url.match(/vimeo\.com\/(\d+)/)
  if (vm) return { provider: 'vimeo', id: vm[1]! }
  return null
}
```

TDD：6+ test cases (`youtube.com/watch?v=`, `youtu.be/`, `youtube.com/embed/`, `vimeo.com/`, bad URL, empty)。

Server action `updateProfileAction` validate URL：parseVideoUrl returns null → throw `INVALID_VIDEO_URL`。

### 4.4 Bio sanitization

`src/lib/sanitize.ts`:

```ts
import sanitizeHtml from 'sanitize-html'

export function sanitizeBioHtml(input: string): string {
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

`updateProfileAction` 在儲存前 sanitize；public page render 直接信任 DB 內容（已 sanitized）。

### 4.5 TipTap editor wrapper

`src/app/(tenant)/settings/profile/bio-editor.tsx`（'use client'）：
- Uses `@tiptap/react` + `@tiptap/starter-kit` (`Bold`, `Italic`, `BulletList`, `OrderedList`, `Heading`, `Link`, `Paragraph` already in StarterKit; 加 Link extension)
- `editor.getHTML()` → submit
- 初始載入 `editor.commands.setContent(initialHtml)` (HTML round-trip safe — sanitized HTML 仍是 TipTap 可吃的標籤)

Bundle impact 預估 +35 KB minified（只在 /settings/profile 載入）。

### 4.6 Photo upload flow

`src/app/(tenant)/settings/profile/photo-gallery-manager.tsx`（'use client'）：

```
1. User drags file(s) into dropzone
2. Per file:
   a. Client validates type + size (5MB limit前端先擋)
   b. POST /api/storage/upload (new route) — server action 形式 OR 直接 Supabase client-side upload
   c. Got storage_path → call `addPhotoAction({ storage_path, caption: '' })`
3. Refresh gallery (revalidatePath)
```

Choice: 用 Supabase client-side upload（直接 from browser）+ tenant ownership 由 Storage RLS 強制 + 後端 action 只負責插 tenant_photos row。

Server actions:
- `addPhotoAction({ storage_path, caption })` — validates path starts with `<owner_tenant_id>/`, count < 10, inserts row
- `updatePhotoCaptionAction({ id, caption })`
- `deletePhotoAction({ id })` — delete row + remove from Storage（在 RPC 內或 server action 內呼叫 Supabase storage API）

### 4.7 公開頁 not-logged-in CTA

新 `src/components/public-page/auth-cta.tsx`：

```tsx
export default function AuthCta({ slug, returnPath }: { slug: string; returnPath: string }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
      <p className="font-medium text-amber-900">尚未登入</p>
      <p className="mt-1 text-amber-800">登入或註冊後即可購買套裝 / 預約時段。</p>
      <div className="mt-3 flex gap-2">
        <Link
          href={`/login?redirect=${encodeURIComponent(returnPath)}`}
          className={buttonVariants({ size: 'sm' })}
        >
          登入
        </Link>
        <Link
          href={`/signup?redirect=${encodeURIComponent(returnPath)}`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          註冊
        </Link>
      </div>
    </div>
  )
}
```

`/[slug]/page.tsx` 與 `/[slug]/packages/page.tsx` 各引入一次。需要拿到 optional session（不 throw 未登入），用既有 `getSession()` helper（若無、新建 helper 回 `session | null`）。

---

## 5. 學員登入流程改造

### 5.1 `signupAction` 加 redirect 邏輯

`src/app/(auth)/signup/actions.ts`（既有）— 改：

```ts
const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(60),
  inviteToken: z.string().optional(),
  redirectTo: z.string().optional(),         // NEW
})

export const signupAction = actionClient
  .inputSchema(SignupSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.signUp({
      email: parsedInput.email,
      password: parsedInput.password,
      options: {
        data: { display_name: parsedInput.displayName },
      },
    })
    if (error) throw new AppError('SIGNUP_FAILED', error.message)

    // If invite token, attempt to accept (existing logic) — pass session through
    if (parsedInput.inviteToken) { /* existing */ }

    // Determine redirect target
    const safeRedirect = parsedInput.redirectTo?.startsWith('/') ? parsedInput.redirectTo : '/'

    // If session is present, user is auto-logged-in — redirect to target
    if (data.session) redirect(safeRedirect)

    // No session → email confirmation flow. Use /login with signedup + redirect
    redirect(`/login?signedup=1&redirect=${encodeURIComponent(safeRedirect)}`)
  })
```

Form (`/signup/page.tsx`) 已取 `?redirect=` 但沒 forward；改為呼叫 action 時帶 `redirectTo: redirect ?? undefined`。

### 5.2 `/login` form 已支援 `?redirect=`

Form 內：`const redirectTo = params.get('redirect') ?? '/'`、`execute({ email, password, redirectTo })`。`loginAction` 用 `redirect(redirectTo)` — 已正常運作。確認 `loginAction` 同樣只允許 `startsWith('/')` 防 open-redirect。

### 5.3 Open-redirect 防護

兩個 action 都需要：

```ts
const safeRedirect = redirectTo?.startsWith('/') && !redirectTo.startsWith('//')
  ? redirectTo
  : '/'
```

避免 `redirect=https://evil.example.com` 的 phishing 攻擊。

---

## 6. 檔案異動清單

### Create

**Migrations**：
- `supabase/migrations/202605261XXXXX_tenants_intro_columns.sql`
- `supabase/migrations/202605261XXXXX_tenant_photos_schema.sql`
- `supabase/migrations/202605261XXXXX_tenant_photos_rls.sql`
- `supabase/migrations/202605261XXXXX_storage_coach_media_bucket.sql`

**Code**：
- `src/lib/sanitize.ts`
- `src/lib/storage.ts` — `uploadCoachMedia()`, `getCoachMediaUrl()`, `deleteCoachMedia()`
- `tests/unit/video-embed.test.ts` — parseVideoUrl TDD
- `src/components/public-page/video-embed.tsx` — parseVideoUrl + VideoEmbed component
- `src/components/public-page/bio-block.tsx`
- `src/components/public-page/photo-gallery.tsx`
- `src/components/public-page/auth-cta.tsx`
- `src/app/(tenant)/settings/profile/avatar-uploader.tsx`
- `src/app/(tenant)/settings/profile/bio-editor.tsx` (TipTap)
- `src/app/(tenant)/settings/profile/video-input.tsx`
- `src/app/(tenant)/settings/profile/photo-gallery-manager.tsx`
- `src/app/(tenant)/settings/profile/photo-actions.ts` — add / update caption / delete

### Modify

- `src/lib/supabase/types.ts` (regen)
- `src/app/(tenant)/settings/profile/page.tsx` — query 新欄位 + tenant_photos
- `src/app/(tenant)/settings/profile/profile-form.tsx` 或拆 — 整合 5 個 section
- `src/app/(tenant)/settings/profile/actions.ts` — updateProfileAction 加 avatar/bio/video + sanitize
- `src/app/[tenantSlug]/page.tsx` — hero avatar inset + bio + video + gallery + auth CTA
- `src/app/[tenantSlug]/packages/page.tsx` — auth CTA in header
- `src/app/(auth)/signup/actions.ts` — redirect logic + open-redirect 防護
- `src/app/(auth)/signup/page.tsx` — `?redirect=` forward
- `src/app/(auth)/login/actions.ts` — confirm safeRedirect helper
- `src/lib/auth/get-session.ts` — add `getSession()` 回 `session | null`（若尚未存在）
- `package.json` — `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `sanitize-html`, `@types/sanitize-html` (devDep)
- `scripts/seed-test-data.mjs` — 林教練 bio + cover + 1 video + 2 photos
- `README.md` — Storage 設定 + 介紹頁 + auth flow 三節
- `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md` 附錄 C — FR-131~136

---

## 7. 風險與緩解

| 風險 | 機率 | 緩解 |
|---|---|---|
| TipTap bundle 太大、影響後台 LCP | 中 | TipTap 僅在 /settings/profile 載入；其他後台頁面不引入；考慮 `next/dynamic` import 加 loading skeleton |
| Storage RLS 寫錯導致 cross-tenant 上傳 | 中 | RLS 用 `(storage.foldername(name))[1]::uuid in current_user_owner_tenant_ids()`；integration test 跑跨 tenant case |
| YouTube/Vimeo iframe XSS | 中 | `parseVideoUrl` 只 accept whitelisted hosts + 11-char ID regex；reject 其他 URL；iframe src 由 ID 組裝、不 echo 原始 URL |
| Sanitize bio 漏 XSS | 中 | sanitize-html 是 widely-vetted lib；allowedTags 白名單；無 `<script>` `<iframe>` `<style>`；href 限 http/https/mailto |
| Open-redirect from login/signup redirect | 中 | safeRedirect 強制 `startsWith('/')` 且 `!startsWith('//')` |
| Storage 大小爆炸（用戶上傳超量） | 低 | bucket 5MB/file + 10張上限 = max 50MB/tenant；可接受 |
| Auto-login fails on email-confirm-required project | 中 | signupAction 檢查 `data.session` 是否存在；若無 fallback 到 /login?signedup=1&redirect=X |
| Public page bundle 增加 | 低 | sanitize-html 全在 server；TipTap 不在公開頁；新增的 component 都是 server component（除 SlotPicker 既有 client）|

---

## 8. doc 更新清單（按 [feedback-docs-after-impl] memory）

- `README.md`：加「教練介紹頁」、「Storage bucket 設定」、「Auth flow（含 redirect 處理）」三節
- `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md` 附錄 C：FR-131~136 條目 + commit hash

---

## 9. 後續

完成本 spec → invoke writing-plans → 產 plan → subagent-driven 執行 → commit hash 回寫附錄 C。S5 完成後接 S6（主題色 / 字型統一 + UI/UX + 架構 / 資安 review）。
