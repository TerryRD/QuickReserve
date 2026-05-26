# S6 — Design Refresh (Direction C · Bold Stripe) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `claudeDesign/` Direction C（Bold Stripe / 條紋運動，B&W + 鮮黃 accent，Anton + Space Grotesk + Noto Sans TC + Space Mono）的設計系統與頁面結構套進 QuickReserve；接上 next-themes Dark mode toggle；RWD 三斷點全頁面通過。

**Architecture:** 兩階段：(a) 把 Direction C tokens 寫進 `globals.css` 覆蓋既有 `:root` + `.dark`，把 4 套 Google Font 換掉 `layout.tsx`，包 `ThemeProvider`；建立 6 個共用 primitive（QRMark / PrimaryCta / SectionHead / ThemeToggle / Pill / Badge-extend）。(b) 逐頁套新視覺結構 — 公開頁 / packages / book / my-bookings / 後台 dashboard / calendar / services / customers / packages / settings — 保留現有 server-side data fetching + server actions，只重寫 JSX + className 結構。Claude Design 的 jsx artifact 在 `claudeDesign/{student,coach}/page-*.jsx` 是視覺權威；TSX 把 mock data 替換為實際 DB 資料即可。

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Tailwind v4 (CSS-based config via `@theme inline`), shadcn/base-ui, next-themes 0.4.6, Google Fonts (`next/font/google`), Supabase, Vitest.

**Spec reference:** [`docs/superpowers/specs/2026-05-26-s6-design-refresh-design.md`](../specs/2026-05-26-s6-design-refresh-design.md)

**Brief reference:** Direction C 選定 — `claudeDesign/styles/tokens.css` `.dir-c` 區塊；4 個 brief 與對應 jsx 在 `docs/superpowers/briefs/s6/` 與 `claudeDesign/{student,coach,QuickReserve *.html}`

**Out of scope:** 新功能、商業邏輯改動、`/platform/*` 平台管理員頁面（沿用後台 design language 直接 derive）、`/invite/[token]` （簡單頁、用新 primitive 後自然得到）、架構/資安 audit（S7）。

---

## File Map

**Create (foundation)**

- `src/components/theme-provider.tsx` — next-themes wrapper（client component）
- `src/components/theme-toggle.tsx` — light/dark/system 三態 toggle button
- `src/components/brand/qr-mark.tsx` — 自訂 logo SVG（從 `claudeDesign/student/atoms.jsx::QRMark` 抽）
- `src/components/ui/primary-cta.tsx` — 黑底 + 鮮黃箭頭圈 CTA pill（Claude Design 的 PrimaryCta）
- `src/components/ui/section-head.tsx` — 雙語 section header（kicker / 中文 / 英文 + 鮮黃底線）
- `src/components/ui/badge.tsx` — 5 variant pill（yellow/black/outline/mutedOutline/neutral）+ mono font

**Modify (foundation)**

- `src/app/globals.css` — 重寫 `:root` + `.dark` 為 Direction C tokens；保留 shadcn token 名；更新 font variables；radius 改 0.75rem
- `src/app/layout.tsx` — 替換 3 套 next/font for 4 套（Anton / Space Grotesk / Space Mono / Noto Sans TC）+ 包 ThemeProvider
- `src/components/ui/button.tsx` — 加 `accent` variant（yellow background）+ 較大 size token（lg = h-12, pillShape）

**Modify (pages — 14 個區塊)**

Student-facing:
- `src/app/[tenantSlug]/page.tsx` + `src/app/[tenantSlug]/slot-picker.tsx`
- `src/app/[tenantSlug]/packages/page.tsx` + `purchase-request-form.tsx`
- `src/app/book/[slotId]/page.tsx`
- `src/app/(customer)/my-bookings/page.tsx`
- `src/app/(auth)/layout.tsx` + `login/page.tsx` + `signup/page.tsx`

Coach-facing:
- `src/app/(tenant)/sidebar-nav.tsx` + `src/app/(tenant)/layout.tsx`
- `src/app/(tenant)/dashboard/page.tsx`
- `src/app/(tenant)/calendar/page.tsx` + `calendar-panel.tsx` + `week-grid.tsx` + `list-view.tsx` + `month-view.tsx` + `slot-popover.tsx`
- `src/app/(tenant)/services/page.tsx` + `service-form-dialog.tsx`
- `src/app/(tenant)/customers/page.tsx`
- `src/app/(tenant)/packages/page.tsx` + `package-form-dialog.tsx` + `package-actions-row.tsx`
- `src/app/(tenant)/packages/pending/page.tsx` + `purchase-row.tsx`
- `src/app/(tenant)/notifications/page.tsx`

Settings/config:
- `src/app/(tenant)/settings/profile/profile-form.tsx`（visual layer only — S5 結構不動）+ avatar-uploader / video-input / bio-editor / photo-gallery-manager
- `src/app/(tenant)/settings/notifications/page.tsx`
- `src/app/(tenant)/calendar/availability/page.tsx` + sub-components
- `src/app/(tenant)/calendar/rules/page.tsx` + sub-components

**Modify (docs/finals)**

- `README.md` — 新增「主題與字型」、「Dark mode」、「Design language」三節
- `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md` — 附錄 C 加 FR-137~143
- 必要時更新 `next.config.ts`（若需要 fontDisplay = 'swap' 等）

---

## Conventions / Recipes（套用在所有 page tasks）

**字型 className 對應：**
- 中文混排 body / form input：default（會走 `--font-sans` = Space Grotesk + `--font-cjk` = Noto Sans TC）
- 大標 display（uppercase, condensed Anton）：`className="font-display"` 或 `style={{ fontFamily: 'var(--font-display), var(--font-cjk)' }}`
- mono kicker / 標籤：`className="font-mono"` 或 `style={{ fontFamily: 'var(--font-mono)' }}`

**Color token 對應：**
- Primary 動作 / 主色塊：`bg-primary text-primary-foreground`
- Accent / 強調黃：`bg-accent text-accent-foreground`
- 卡片底：`bg-card`
- Section 區隔：`bg-muted`（淡灰）
- 對比邊框：`border border-border`
- 次要文字：`text-muted-foreground`

**字型/字級 patterns（Direction C 特徵）：**
- Section kicker：`font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground`
- 大標 H1：`font-display uppercase text-[60px] sm:text-[92px] lg:text-[128px] leading-[0.9] tracking-tight`
- 中文標題（與英文並列）：在中文 span 加 `font-display`（會自動 fallback CJK），英文用 `<span>` 加鮮黃底線 `relative` + pseudo
- 卡片標題：`font-display font-black text-[22px]`
- 卡片內價格：`font-display text-[22px] border-b-[3px] border-accent pb-px`
- Mono 標籤：`font-mono text-[11px] tracking-[0.06em]`

**Pill shape：** `rounded-full px-3 py-1` + `font-mono text-[11px] uppercase tracking-wider`

**Card：** `bg-card border border-border rounded-[calc(var(--radius)+6px)] p-5 shadow-[0_1px_0_var(--border),0_8px_24px_-18px_rgba(0,0,0,0.18)]`

**SlotPicker month-grid pattern：** 見 `claudeDesign/student/atoms.jsx::SlotPicker` — 7-col grid + 6 rows，禁用日期 muted bg + cursor-not-allowed，今天用 accent 黃圓，selected 用 foreground 反白 + 底部 3px accent 條，「剩 ≤ 3」用小黃點。

**RWD breakpoints：**
- Mobile: `< 640px` (default)
- Tablet: `sm:` / `md:` (640~1023px)
- Desktop: `lg:` (≥1024px)

---

## Task 1: 確認 deps 安裝、跑 baseline verify

**Files:** N/A

- [ ] **Step 1: 確認 next-themes 已安裝（v0.4.6 per package.json）**

```bash
npm ls next-themes
```
Expected: `next-themes@0.4.6`

- [ ] **Step 2: 安裝 4 套新 Google Font 對應的 next/font sub-package（不需要、next/font 內建）**

Run: `npm ls next` — confirm Next 15 installed; next/font/google 已是內建。

- [ ] **Step 3: 跑 baseline verify**

```bash
npm run typecheck
npm test
npm run lint
```
Expected: 全綠（lint warnings OK），baseline 100% green。

如非綠先修，否則後續 task 會繼承 baseline 紅。

- [ ] **Step 4: 記錄 baseline commit hash（不要 commit、只記）**

```bash
git rev-parse HEAD
```
記下，方便 review 時 git diff baseline。

---

## Task 2: ThemeProvider wrapper

**Files:**
- Create: `src/components/theme-provider.tsx`

- [ ] **Step 1: Write file**

```tsx
'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ComponentProps } from 'react'

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck` → Expected PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/theme-provider.tsx
git commit -m "$(cat <<'EOF'
feat(s6): ThemeProvider wrapper for next-themes

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Update layout.tsx — 4 新字 + ThemeProvider wrap

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Replace file 內容**

```tsx
import type { Metadata } from 'next'
import { Anton, Space_Grotesk, Space_Mono, Noto_Sans_TC } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const display = Anton({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
})

const sans = Space_Grotesk({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const mono = Space_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
})

const cjk = Noto_Sans_TC({
  variable: '--font-cjk',
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  title: 'QuickReserve — 預約管理 SaaS',
  description: '專業教練的預約系統。設定時段、開放連結、收單一條龍。',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <body
        className={`${display.variable} ${sans.variable} ${mono.variable} ${cjk.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
```

**Notes:**
- `Noto_Sans_TC` 用 `preload: false` 避免重首屏 bundle —— 由 CSS fallback chain 在中文出現時觸發
- `suppressHydrationWarning` 是 next-themes 文件官方建議
- `attribute="class"` 讓 next-themes 在 `<html>` 切 `class="dark"`，配合 `.dark` selector

- [ ] **Step 2: typecheck**

Run: `npm run typecheck` → Expected PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "$(cat <<'EOF'
feat(s6): switch fonts to Anton/SpaceGrotesk/SpaceMono/NotoSansTC + ThemeProvider

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Rewrite globals.css — Direction C tokens

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace 整個檔案內容**（保留現有 imports + `@theme inline` 區、改變數值 + 加 `--font-cjk`）

```css
@import 'tailwindcss';
@import 'tw-animate-css';
@import 'shadcn/tailwind.css';

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-display: var(--font-display);
  --font-heading: var(--font-display);
  --font-cjk: var(--font-cjk);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

/* === LIGHT (Direction C · Bold Stripe) === */
:root {
  --background: oklch(0.985 0 0);
  --foreground: oklch(0.14 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.14 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.14 0 0);
  --primary: oklch(0.16 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.94 0 0);
  --secondary-foreground: oklch(0.18 0 0);
  --muted: oklch(0.965 0 0);
  --muted-foreground: oklch(0.42 0 0);
  --accent: oklch(0.91 0.19 102);
  --accent-foreground: oklch(0.14 0 0);
  --destructive: oklch(0.55 0.22 25);
  --border: oklch(0.86 0 0);
  --input: oklch(0.90 0 0);
  --ring: oklch(0.16 0 0);
  --chart-1: oklch(0.91 0.19 102);
  --chart-2: oklch(0.55 0.15 240);
  --chart-3: oklch(0.6 0.14 160);
  --chart-4: oklch(0.7 0.16 70);
  --chart-5: oklch(0.5 0.12 300);
  --radius: 0.75rem;
  --sidebar: oklch(0.14 0 0);
  --sidebar-foreground: oklch(0.96 0 0);
  --sidebar-primary: oklch(0.91 0.19 102);
  --sidebar-primary-foreground: oklch(0.14 0 0);
  --sidebar-accent: oklch(0.22 0 0);
  --sidebar-accent-foreground: oklch(0.96 0 0);
  --sidebar-border: oklch(0.24 0 0);
  --sidebar-ring: oklch(0.91 0.19 102);
}

/* === DARK === */
.dark {
  --background: oklch(0.135 0 0);
  --foreground: oklch(0.97 0 0);
  --card: oklch(0.175 0 0);
  --card-foreground: oklch(0.97 0 0);
  --popover: oklch(0.18 0 0);
  --popover-foreground: oklch(0.97 0 0);
  --primary: oklch(0.91 0.19 102);
  --primary-foreground: oklch(0.135 0 0);
  --secondary: oklch(0.23 0 0);
  --secondary-foreground: oklch(0.95 0 0);
  --muted: oklch(0.20 0 0);
  --muted-foreground: oklch(0.70 0 0);
  --accent: oklch(0.91 0.19 102);
  --accent-foreground: oklch(0.135 0 0);
  --destructive: oklch(0.66 0.22 25);
  --border: oklch(0.28 0 0);
  --input: oklch(0.25 0 0);
  --ring: oklch(0.91 0.19 102);
  --sidebar: oklch(0.10 0 0);
  --sidebar-foreground: oklch(0.95 0 0);
  --sidebar-primary: oklch(0.91 0.19 102);
  --sidebar-primary-foreground: oklch(0.14 0 0);
  --sidebar-accent: oklch(0.22 0 0);
  --sidebar-accent-foreground: oklch(0.96 0 0);
  --sidebar-border: oklch(0.24 0 0);
  --sidebar-ring: oklch(0.91 0.19 102);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
    font-family: var(--font-sans), var(--font-cjk), system-ui, sans-serif;
  }
  html {
    @apply font-sans;
  }
  .font-display {
    font-family: var(--font-display), var(--font-cjk), serif;
    letter-spacing: -0.01em;
  }
  .font-cjk {
    font-family: var(--font-cjk), var(--font-sans), sans-serif;
  }
  .font-mono {
    font-family: var(--font-mono), ui-monospace, monospace;
  }
  /* Decorative grain — preserved */
  .grain {
    position: relative;
  }
  .grain::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' /%3E%3CfeColorMatrix values='0 0 0 0 0.1 0 0 0 0 0.1 0 0 0 0 0.15 0 0 0 0.12 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    opacity: 0.4;
    mix-blend-mode: multiply;
  }
  .dot-grid {
    background-image: radial-gradient(currentColor 1px, transparent 1px);
    background-size: 24px 24px;
    background-position: 0 0;
  }
}
```

- [ ] **Step 2: typecheck + build smoke**

```bash
npm run typecheck
npm run build  # confirm CSS still compiles
```
Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "$(cat <<'EOF'
feat(s6): globals.css Direction C tokens (B&W + yellow accent, radius 0.75rem)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: ThemeToggle component

**Files:**
- Create: `src/components/theme-toggle.tsx`

- [ ] **Step 1: Write file**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

const ORDER = ['light', 'dark', 'system'] as const
type Mode = (typeof ORDER)[number]

const LABEL: Record<Mode, string> = {
  light: '日',
  dark: '夜',
  system: '系統',
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div
        aria-hidden
        className={`inline-flex h-9 w-[112px] items-center rounded-full border border-border bg-card ${className ?? ''}`}
      />
    )
  }

  const current = (theme as Mode) ?? 'system'

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-1 ${className ?? ''}`}
      role="radiogroup"
      aria-label="主題切換"
    >
      {ORDER.map((mode) => {
        const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor
        const active = current === mode
        return (
          <Button
            key={mode}
            type="button"
            variant={active ? 'default' : 'ghost'}
            size="sm"
            role="radio"
            aria-checked={active}
            aria-label={LABEL[mode]}
            onClick={() => setTheme(mode)}
            className="h-7 gap-1 rounded-full px-2.5"
          >
            <Icon className="size-3.5" />
            <span className="font-mono text-[10px] tracking-wider">{LABEL[mode]}</span>
          </Button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck` → Expected PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/theme-toggle.tsx
git commit -m "$(cat <<'EOF'
feat(s6): ThemeToggle component (light/dark/system 3-state pill)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Brand QRMark logo SVG

**Files:**
- Create: `src/components/brand/qr-mark.tsx`

- [ ] **Step 1: Write file**（從 `claudeDesign/student/atoms.jsx::QRMark` 抽出）

```tsx
type Props = {
  size?: number
  className?: string
}

export function QRMark({ size = 32, className }: Props) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-label="QuickReserve"
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <rect width="32" height="32" rx="9" fill="oklch(0.14 0 0)" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      <path d="M 14.6 14.6 L 14.6 7.2 A 7.4 7.4 0 0 1 22 14.6 Z" fill="oklch(0.91 0.19 102)" />
      <circle cx="14.6" cy="14.6" r="7.8" fill="none" stroke="#FFFFFF" strokeWidth="2.4" />
      <circle cx="14.6" cy="14.6" r="1.3" fill="#FFFFFF" />
      <line x1="17.4" y1="17.4" x2="22.6" y2="22.6" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}
```

- [ ] **Step 2: typecheck + Commit**

```bash
npm run typecheck
git add src/components/brand/qr-mark.tsx
git commit -m "$(cat <<'EOF'
feat(s6): QRMark logo (custom SVG, yellow sector + white circle)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: PrimaryCta button

**Files:**
- Create: `src/components/ui/primary-cta.tsx`

- [ ] **Step 1: Write file**

```tsx
import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = ButtonPrimitive.Props & {
  size?: 'md' | 'lg'
  className?: string
}

export function PrimaryCta({ size = 'lg', className, children, ...rest }: Props) {
  const h = size === 'lg' ? 'h-[52px]' : 'h-11'
  const padding = size === 'lg' ? 'pl-7 pr-2' : 'pl-5 pr-1.5'
  const text = size === 'lg' ? 'text-[14.5px]' : 'text-[13.5px]'
  const ring = size === 'lg' ? 'size-9' : 'size-8'

  return (
    <ButtonPrimitive
      data-slot="primary-cta"
      className={cn(
        'group/cta inline-flex items-center gap-3.5 rounded-full',
        'bg-primary text-primary-foreground font-semibold',
        'transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/40',
        'active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
        'font-sans tracking-wide',
        h,
        padding,
        text,
        className,
      )}
      {...rest}
    >
      {children}
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full',
          'bg-accent text-accent-foreground',
          'transition-transform group-hover/cta:translate-x-0.5',
          ring,
        )}
      >
        <ArrowRight className="size-3.5" />
      </span>
    </ButtonPrimitive>
  )
}
```

- [ ] **Step 2: typecheck + Commit**

```bash
npm run typecheck
git add src/components/ui/primary-cta.tsx
git commit -m "$(cat <<'EOF'
feat(s6): PrimaryCta button (yellow arrow circle pattern)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: SectionHead component

**Files:**
- Create: `src/components/ui/section-head.tsx`

- [ ] **Step 1: Write file**（從 `claudeDesign/student/atoms.jsx::SectionHead` 抽）

```tsx
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  kicker?: string
  title?: string
  eng?: string
  hint?: string
  right?: ReactNode
  className?: string
}

export function SectionHead({ kicker, title, eng, hint, right, className }: Props) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-wrap items-end justify-between gap-4',
        className,
      )}
    >
      <div>
        {kicker && (
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {kicker}
          </div>
        )}
        {(title || eng) && (
          <h2 className="font-display flex flex-wrap items-baseline gap-3.5 text-[42px] font-normal uppercase leading-[0.95] tracking-tight">
            {title && <span className="font-cjk">{title}</span>}
            {eng && (
              <span className="relative inline-block">
                {eng}
                <span
                  aria-hidden
                  className="absolute inset-x-0 -bottom-0.5 h-1.5 rounded-md bg-accent"
                />
              </span>
            )}
          </h2>
        )}
        {hint && (
          <div className="font-cjk mt-3 text-[13px] text-muted-foreground">
            {hint}
          </div>
        )}
      </div>
      {right}
    </div>
  )
}
```

- [ ] **Step 2: typecheck + Commit**

```bash
npm run typecheck
git add src/components/ui/section-head.tsx
git commit -m "$(cat <<'EOF'
feat(s6): SectionHead component (bilingual + yellow underline)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Badge component（5 variant pill）

**Files:**
- Create: `src/components/ui/badge.tsx`

- [ ] **Step 1: Write file**

```tsx
import type { ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em]',
  {
    variants: {
      variant: {
        neutral: 'bg-secondary text-foreground',
        yellow: 'bg-accent text-accent-foreground',
        black: 'bg-primary text-primary-foreground',
        outline: 'border border-border bg-transparent text-foreground',
        mutedOutline: 'border border-border bg-transparent text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
)

type Props = {
  children: ReactNode
  icon?: ReactNode
  className?: string
} & VariantProps<typeof badgeVariants>

export function Badge({ children, icon, className, variant, ...rest }: Props) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...rest}>
      {icon}
      {children}
    </span>
  )
}

export type StatusType = 'pending' | 'confirmed' | 'cancelled' | 'completed'

const STATUS_VARIANT: Record<StatusType, Props['variant']> = {
  pending: 'yellow',
  confirmed: 'black',
  cancelled: 'outline',
  completed: 'mutedOutline',
}

const STATUS_LABEL: Record<StatusType, string> = {
  pending: '待確認',
  confirmed: '已確認',
  cancelled: '已取消',
  completed: '已完成',
}

export function StatusBadge({ status, className }: { status: StatusType; className?: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      {STATUS_LABEL[status]}
    </Badge>
  )
}

export { badgeVariants }
```

- [ ] **Step 2: typecheck + Commit**

```bash
npm run typecheck
git add src/components/ui/badge.tsx
git commit -m "$(cat <<'EOF'
feat(s6): Badge + StatusBadge (5 variants, mono uppercase pill)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Extend Button — accent variant + new size

**Files:**
- Modify: `src/components/ui/button.tsx`

- [ ] **Step 1: 加 `accent` variant + 加 `xl` size**

把 variant 區的 `link` 後面加：
```ts
accent: 'bg-accent text-accent-foreground hover:bg-accent/85',
'pill-outline': 'rounded-full border-border bg-transparent text-foreground hover:bg-muted',
```

把 size 區的 `'icon-lg'` 後面加：
```ts
xl: 'h-11 gap-2 px-5 text-sm has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4',
pill: 'h-11 gap-2 rounded-full px-5 text-sm',
```

完整檔案：

```tsx
import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground [a]:hover:bg-primary/80',
        outline:
          'border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
        ghost:
          'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
        destructive:
          'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40',
        link: 'text-primary underline-offset-4 hover:underline',
        accent: 'bg-accent text-accent-foreground hover:bg-accent/85',
        'pill-outline': 'rounded-full border-border bg-transparent text-foreground hover:bg-muted',
      },
      size: {
        default:
          'h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        xl: 'h-11 gap-2 px-5 text-sm has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4',
        pill: 'h-11 gap-2 rounded-full px-5 text-sm',
        icon: 'size-8',
        'icon-xs':
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        'icon-sm':
          'size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg',
        'icon-lg': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
```

- [ ] **Step 2: typecheck + Commit**

```bash
npm run typecheck
git add src/components/ui/button.tsx
git commit -m "$(cat <<'EOF'
feat(s6): Button extend variants (accent, pill-outline) + sizes (xl, pill)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Auth pages — layout + login + signup（先做最小頁、套新視覺）

**Files:**
- Modify: `src/app/(auth)/layout.tsx`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/signup/page.tsx`

**Reference:** `claudeDesign/student/page-auth.jsx`

- [ ] **Step 1: 看 reference**

Read `claudeDesign/student/page-auth.jsx`：注意 layout 結構（左半 hero + 右半 form on desktop / single column on mobile），QRMark 在 TopBar，「返回首頁」ghost button，大標 display uppercase + 中文。

- [ ] **Step 2: 更新 layout.tsx**

```tsx
// src/app/(auth)/layout.tsx
import Link from 'next/link'
import { QRMark } from '@/components/brand/qr-mark'
import { ThemeToggle } from '@/components/theme-toggle'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-10">
        <Link href="/" className="flex items-center gap-3">
          <QRMark size={36} />
          <div className="leading-tight">
            <div className="font-display text-base uppercase tracking-wider">QuickReserve</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              BOOK · YOUR · COACH
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto flex max-w-[1200px] flex-col gap-12 px-5 py-10 sm:px-10 lg:flex-row lg:items-center lg:gap-20 lg:py-20">
        {/* hero side */}
        <section className="lg:flex-1">
          <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            QUICKRESERVE · LOG IN
          </div>
          <h1 className="font-display text-[64px] uppercase leading-[0.9] tracking-tight sm:text-[88px] lg:text-[110px]">
            BOOK
            <br />
            YOUR
            <br />
            <span className="relative inline-block">
              COACH
              <span aria-hidden className="absolute -bottom-1 left-0 right-0 h-2 rounded bg-accent" />
            </span>
          </h1>
          <p className="font-cjk mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            登入或建立帳號後，即可開始預約您專屬教練的時段。
          </p>
        </section>
        {/* form side */}
        <section className="w-full lg:max-w-[440px]">{children}</section>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: 更新 login/page.tsx**（保留 'use client' 與既有 loginAction wiring）

把現有 SignupForm 結構改為新視覺（大致照 `claudeDesign/student/page-auth.jsx` form 區），重點：
- 卡片用 `bg-card border border-border rounded-2xl p-8` 包住
- 大標用 `font-display text-3xl uppercase`
- 輸入框 `h-12 rounded-xl border-2 border-border bg-background px-4`
- 主送出按鈕用 `<PrimaryCta>` 取代既有 Button
- `?signedup=1` banner 改 `bg-accent text-accent-foreground rounded-xl px-4 py-3 font-cjk text-sm`
- 「還沒有帳號？建立帳號」連結 mono small caps 處理

完整 file 替換：

```tsx
'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PrimaryCta } from '@/components/ui/primary-cta'
import { loginAction } from './actions'

function LoginForm() {
  const params = useSearchParams()
  const redirectTo = params.get('redirect') ?? '/'
  const signedUp = params.get('signedup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const { execute, isPending } = useAction(loginAction, {
    onError: ({ error }) => {
      toast.error(error.serverError?.message ?? '登入失敗')
    },
  })

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-[0_1px_0_var(--border),0_8px_24px_-18px_rgba(0,0,0,0.18)]">
      <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        SIGN IN
      </div>
      <h2 className="font-display mb-6 text-3xl uppercase leading-none tracking-tight">
        歡迎<span className="font-cjk">回來</span>
      </h2>

      {signedUp && (
        <div className="mb-6 rounded-xl bg-accent px-4 py-3 font-cjk text-sm text-accent-foreground">
          ✓ 註冊成功，請使用該帳號登入
        </div>
      )}

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          execute({ email, password, redirectTo })
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email" className="font-mono text-[11px] uppercase tracking-wider">
            EMAIL
          </Label>
          <Input
            id="email"
            type="email"
            required
            className="font-cjk h-12 rounded-xl border-2 border-border bg-background px-4 text-sm"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="font-mono text-[11px] uppercase tracking-wider">
            PASSWORD
          </Label>
          <Input
            id="password"
            type="password"
            required
            className="font-cjk h-12 rounded-xl border-2 border-border bg-background px-4 text-sm"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <PrimaryCta type="submit" disabled={isPending} className="w-full justify-between">
          {isPending ? '登入中...' : '登入'}
        </PrimaryCta>
      </form>

      <p className="mt-8 border-t border-border pt-6 text-center font-cjk text-sm text-muted-foreground">
        還沒有帳號？{' '}
        <Link href="/signup" className="font-semibold text-foreground underline-offset-4 hover:underline">
          建立帳號
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
```

- [ ] **Step 4: 更新 signup/page.tsx**（同 pattern + 加 displayName 欄位 + 處理 inviteToken 顯示）

完整 file：

```tsx
'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PrimaryCta } from '@/components/ui/primary-cta'
import { signupAction } from './actions'

function SignupForm() {
  const params = useSearchParams()
  const inviteToken = params.get('invite')
  const redirectTo = params.get('redirect')
  const presetEmail = params.get('email') ?? ''
  const [email, setEmail] = useState(presetEmail)
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')

  const { execute, isPending } = useAction(signupAction, {
    onError: ({ error }) => {
      toast.error(error.serverError?.message ?? '註冊失敗')
    },
  })

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-[0_1px_0_var(--border),0_8px_24px_-18px_rgba(0,0,0,0.18)]">
      <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        CREATE ACCOUNT
      </div>
      <h2 className="font-display mb-2 text-3xl uppercase leading-none tracking-tight">
        建立<span className="font-cjk">帳號</span>
      </h2>
      <p className="font-cjk mb-6 text-sm text-muted-foreground">
        {inviteToken ? '完成註冊後將自動接受邀請' : '註冊後即可預約教練的課程'}
      </p>

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          execute({
            email,
            password,
            displayName,
            inviteToken: inviteToken ?? undefined,
            redirectTo: redirectTo ?? undefined,
          })
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="displayName" className="font-mono text-[11px] uppercase tracking-wider">
            姓名 NAME
          </Label>
          <Input
            id="displayName"
            required
            className="font-cjk h-12 rounded-xl border-2 border-border bg-background px-4 text-sm"
            placeholder="您的名字"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="font-mono text-[11px] uppercase tracking-wider">
            EMAIL
          </Label>
          <Input
            id="email"
            type="email"
            required
            className="font-cjk h-12 rounded-xl border-2 border-border bg-background px-4 text-sm"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="font-mono text-[11px] uppercase tracking-wider">
            PASSWORD
          </Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            className="font-cjk h-12 rounded-xl border-2 border-border bg-background px-4 text-sm"
            placeholder="至少 8 個字元"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <PrimaryCta type="submit" disabled={isPending} className="w-full justify-between">
          {isPending ? '建立中...' : '建立帳號'}
        </PrimaryCta>
      </form>

      <p className="mt-8 border-t border-border pt-6 text-center font-cjk text-sm text-muted-foreground">
        已有帳號？{' '}
        <Link href="/login" className="font-semibold text-foreground underline-offset-4 hover:underline">
          登入
        </Link>
      </p>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  )
}
```

- [ ] **Step 5: typecheck + dev server smoke test**

```bash
npm run typecheck
npm run dev
```
打開 http://localhost:3000/login 與 /signup —— 確認三斷點下都不破版（最低 375px 寬）、字型載入（中文 Noto Sans TC + 英文 Anton/Space Grotesk）、PrimaryCta 黃箭頭圈顯示、ThemeToggle 在 header 切 dark mode 後全黑可用、登入 form 提交仍能呼叫 action。

- [ ] **Step 6: Commit**

```bash
git add "src/app/(auth)/layout.tsx" "src/app/(auth)/login/page.tsx" "src/app/(auth)/signup/page.tsx"
git commit -m "$(cat <<'EOF'
feat(s6): auth pages adopt Direction C (split layout + Card + PrimaryCta)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: 公開頁 `/[tenantSlug]/page.tsx` — hero + bio + video + gallery + services

**Files:**
- Modify: `src/app/[tenantSlug]/page.tsx`

**Reference:** `claudeDesign/student/page-public.jsx`（看 hero / bio / video / gallery / services / slot picker 五個 section structure）

- [ ] **Step 1: Read reference**

Read `claudeDesign/student/page-public.jsx` 仔細看 hero（含 STRENGTH COACH pill / 大型 uppercase 名字 / 中文教練名 / avatar inset / contact pills / PrimaryCta + secondary button / 「訪客可瀏覽 · 預約需登入」 mono note）、Bio section（雙 col：SectionHead 在左、prose 在右、文章寬度限制 640px）、Video section（aspect-video iframe wrapper、左上「YOUTUBE · 03:42」、右上「16 : 9」）、Gallery（3 col grid + figcaption mono）、Services section（背景 `bg-muted` + ServiceCard 在 grid）。

- [ ] **Step 2: 結構性改寫 page.tsx**（保留 server-side data fetching + session + photos + auth CTA、改 JSX）

```tsx
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Mail, Phone, MessageCircle, MapPin, Star } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getTenantBySlug } from '@/lib/auth/get-tenant-context'
import { getSession } from '@/lib/auth/get-session'
import { getCoachMediaPublicUrl } from '@/lib/storage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PrimaryCta } from '@/components/ui/primary-cta'
import { SectionHead } from '@/components/ui/section-head'
import { VideoEmbed } from '@/components/public-page/video-embed'
import SlotPicker from './slot-picker'

export default async function TenantPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>
  searchParams: Promise<{ service?: string; date?: string; from?: string; reschedule?: string }>
}) {
  const { tenantSlug } = await params
  const { service: selectedServiceId, date: selectedDate, from: fromOffset, reschedule: rescheduleFrom } = await searchParams
  const tenant = await getTenantBySlug(tenantSlug)
  if (!tenant) notFound()

  if (tenant.status === 'suspended') {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-8">
        <div className="max-w-md rounded-2xl border border-border bg-card p-10 text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">SUSPENDED</div>
          <h2 className="font-display mt-4 text-2xl uppercase">服務暫停中</h2>
          <p className="font-cjk mt-2 text-sm text-muted-foreground">此教練目前不開放預約，請稍後再試。</p>
        </div>
      </main>
    )
  }

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
  const returnPath = `/${tenantSlug}`
  const activeServiceId = selectedServiceId ?? services?.[0]?.id ?? null
  const dateStr = selectedDate ?? format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-[1200px]">
        {/* HERO */}
        <section className="px-5 py-12 sm:px-10 sm:py-16 lg:px-[72px] lg:py-20">
          <div className="mb-6 flex flex-wrap items-center gap-2 sm:mb-8">
            <Badge variant="yellow" icon={<Star className="size-3" />}>
              COACH
            </Badge>
            <span className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground">
              /{tenant.slug}
            </span>
          </div>
          <h1 className="font-display text-[60px] uppercase leading-[0.9] tracking-tight sm:text-[92px] lg:text-[128px]">
            <span className="font-cjk">{tenant.name}</span>
            <span
              aria-hidden
              className="ml-3 inline-block size-3 rounded-full bg-accent align-baseline sm:size-4"
            />
          </h1>
          <div className="mt-6 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
            {tenant.avatar_url ? (
              <img
                src={tenant.avatar_url}
                alt={tenant.name}
                className="size-[76px] rounded-full border border-border object-cover sm:size-[104px]"
              />
            ) : (
              <div className="grid size-[76px] place-items-center rounded-full border border-border bg-secondary font-display text-2xl sm:size-[104px] sm:text-3xl">
                {tenant.name.slice(0, 1)}
              </div>
            )}
            <p className="font-cjk max-w-xl text-base font-medium leading-relaxed sm:text-lg">
              {tenant.description?.trim() ||
                '在下方選擇您想預訂的服務、日期與時段。送出後狀態為「待確認」，教練確認後即正式成立。'}
            </p>
          </div>
          {(tenant.contact_email || tenant.contact_phone || tenant.contact_line_id || tenant.contact_note) && (
            <div className="mt-7 flex flex-wrap gap-2">
              {tenant.contact_email && (
                <a
                  href={`mailto:${tenant.contact_email}`}
                  className="font-mono inline-flex items-center gap-2 rounded-full bg-secondary px-3.5 py-2 text-xs font-medium hover:bg-muted"
                >
                  <Mail className="size-3" />
                  {tenant.contact_email}
                </a>
              )}
              {tenant.contact_phone && (
                <a
                  href={`tel:${tenant.contact_phone}`}
                  className="font-mono inline-flex items-center gap-2 rounded-full bg-secondary px-3.5 py-2 text-xs font-medium hover:bg-muted"
                >
                  <Phone className="size-3" />
                  {tenant.contact_phone}
                </a>
              )}
              {tenant.contact_line_id && (
                <span className="font-mono inline-flex items-center gap-2 rounded-full bg-secondary px-3.5 py-2 text-xs font-medium">
                  <MessageCircle className="size-3" />
                  LINE {tenant.contact_line_id}
                </span>
              )}
              {tenant.contact_note && (
                <span className="font-mono inline-flex items-center gap-2 rounded-full bg-secondary px-3.5 py-2 text-xs font-medium">
                  <MapPin className="size-3" />
                  {tenant.contact_note}
                </span>
              )}
            </div>
          )}
          {!session && (
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <PrimaryCta size="lg" asChild={false}>
                <Link href={`/login?redirect=${encodeURIComponent(returnPath)}`}>登入預約</Link>
              </PrimaryCta>
              <Button variant="pill-outline" size="xl" asChild={false}>
                <Link href={`/signup?redirect=${encodeURIComponent(returnPath)}`}>建立帳號</Link>
              </Button>
              <span className="font-mono text-[10.5px] tracking-[0.12em] text-muted-foreground">
                訪客可瀏覽 · 預約需登入
              </span>
            </div>
          )}
        </section>

        {rescheduleFrom && (
          <section className="border-t border-border px-5 py-5 sm:px-10 lg:px-[72px]">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-accent px-5 py-4 text-accent-foreground">
              <div className="flex-1">
                <div className="font-cjk text-sm font-bold">改期模式 · 選擇新時段後原預約自動取消</div>
                <div className="font-cjk mt-1 text-xs opacity-90">
                  選擇新時段送出後，原預約會自動取消、堂數退回套裝。
                </div>
              </div>
            </div>
          </section>
        )}

        {/* BIO */}
        {tenant.bio_html && tenant.bio_html.trim() && (
          <section className="border-t border-border px-5 py-12 sm:px-10 sm:py-16 lg:px-[72px]">
            <div className="grid items-start gap-8 lg:grid-cols-[280px_1fr] lg:gap-12">
              <SectionHead kicker="ABOUT · 關於" title="關於我" eng="ABOUT" />
              <article
                className="font-cjk prose prose-sm max-w-[640px] prose-headings:font-display prose-a:text-foreground prose-strong:font-bold"
                dangerouslySetInnerHTML={{ __html: tenant.bio_html }}
              />
            </div>
          </section>
        )}

        {/* VIDEO */}
        {tenant.intro_video_url && (
          <section className="px-5 py-12 sm:px-10 sm:py-16 lg:px-[72px]">
            <div className="grid items-start gap-8 lg:grid-cols-[280px_1fr] lg:gap-12">
              <SectionHead kicker="VIDEO · 介紹影片" title="介紹影片" eng="" hint="了解我的訓練風格" />
              <div className="max-w-[720px]">
                <VideoEmbed url={tenant.intro_video_url} />
              </div>
            </div>
          </section>
        )}

        {/* GALLERY */}
        {photos.length > 0 && (
          <section className="px-5 py-12 sm:px-10 sm:py-16 lg:px-[72px]">
            <SectionHead kicker="SPACE · 環境照片" title="環境" eng="SPACE" />
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {photos.map((p, i) => (
                <figure key={p.id} className="m-0 space-y-2">
                  <div className="overflow-hidden rounded-xl border border-border">
                    <img
                      src={p.public_url}
                      alt={p.caption ?? ''}
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover"
                    />
                  </div>
                  {p.caption && (
                    <figcaption className="font-mono text-xs tracking-wider text-muted-foreground">
                      {String(i + 1).padStart(2, '0')} — {p.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* SERVICES */}
        {services && services.length > 0 && (
          <section
            id="services"
            className="mt-8 border-t border-border bg-muted px-5 py-12 sm:px-10 sm:py-16 lg:px-[72px]"
          >
            <SectionHead
              kicker="SECTION / 03"
              title="服務"
              eng="SERVICES"
              hint="選一個服務、再挑選時段。"
              right={
                <span className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground">
                  {String(services.length).padStart(2, '0')} ITEMS
                </span>
              }
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((s, i) => {
                const isActive = s.id === activeServiceId
                return (
                  <Link
                    key={s.id}
                    href={`/${tenantSlug}?service=${s.id}${selectedDate ? `&date=${selectedDate}` : ''}`}
                    className={`group relative flex flex-col gap-3 rounded-2xl border bg-card p-6 transition-shadow ${
                      isActive
                        ? 'border-foreground ring-2 ring-foreground/10'
                        : 'border-border hover:shadow-[0_8px_24px_-18px_rgba(0,0,0,0.25)]'
                    }`}
                  >
                    <span
                      aria-hidden
                      className="font-display pointer-events-none absolute right-5 top-4 text-7xl leading-none opacity-10"
                    >
                      0{i + 1}
                    </span>
                    <div className="font-mono flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      <span className="h-0.5 w-3.5 rounded bg-accent" />
                      SERVICE / 0{i + 1}
                    </div>
                    <h3 className="font-display font-cjk text-[22px] font-black leading-tight">{s.name}</h3>
                    {s.description && (
                      <p className="font-cjk line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {s.description}
                      </p>
                    )}
                    <div className="mt-auto flex items-baseline justify-between border-t border-dashed border-border pt-3">
                      <span className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground">
                        {s.duration_minutes} 分鐘
                      </span>
                      <span className="font-display border-b-[3px] border-accent pb-px text-[22px] leading-none">
                        NT$ {Number(s.price ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* SLOT PICKER */}
        {activeServiceId && (
          <section className="bg-muted px-5 pb-16 pt-8 sm:px-10 sm:pb-20 lg:px-[72px]">
            <SectionHead kicker="SECTION / 04" title="時段" eng="SLOTS" />
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-7">
              <Suspense fallback={null}>
                <SlotPicker
                  tenantSlug={tenantSlug}
                  tenantId={tenant.id}
                  serviceId={activeServiceId}
                  initialDate={dateStr}
                  fromOffset={Math.max(0, parseInt(fromOffset ?? '0', 10) || 0)}
                  rescheduleFrom={rescheduleFrom ?? null}
                />
              </Suspense>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
```

**Note:** `<PrimaryCta asChild={false}>` 需要修 PrimaryCta 元件接受 `asChild` prop（如果 base-ui Button 也不支援），這裡用 `<Link>` 包外面的舊技倆即 wrapped element 不需要 asChild。

實務上 base-ui 不支援 asChild — 你應該把 PrimaryCta 改成接受 `<Link>` child（render-as-a），或用 ` cn(buttonVariants(...), …)` 帶 className 的方式：把 `<Link>` 套 `<PrimaryCta>` 的 className 直接做樣式。

**修正：** 改用以下 pattern（不用 asChild，而是 className 套到 `<Link>`）：

```tsx
<Link
  href={`/login?redirect=${encodeURIComponent(returnPath)}`}
  className="inline-flex h-[52px] items-center gap-3.5 rounded-full bg-primary pl-7 pr-2 text-[14.5px] font-semibold text-primary-foreground"
>
  登入預約
  <span className="inline-flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" d="M5 12h14m-6 6 6-6-6-6" />
    </svg>
  </span>
</Link>
```

…或更簡單：建立輔助 `<PrimaryCtaLink href={...}>` component 將 PrimaryCta 內容 inline 進 Link。建議在 `src/components/ui/primary-cta.tsx` 加：

```tsx
export function PrimaryCtaLink({
  href,
  size = 'lg',
  className,
  children,
}: {
  href: string
  size?: 'md' | 'lg'
  className?: string
  children: React.ReactNode
}) {
  const h = size === 'lg' ? 'h-[52px]' : 'h-11'
  const padding = size === 'lg' ? 'pl-7 pr-2' : 'pl-5 pr-1.5'
  const text = size === 'lg' ? 'text-[14.5px]' : 'text-[13.5px]'
  const ring = size === 'lg' ? 'size-9' : 'size-8'
  return (
    <Link
      href={href}
      className={cn(
        'group/cta inline-flex items-center gap-3.5 rounded-full',
        'bg-primary text-primary-foreground font-semibold',
        'transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/40',
        h,
        padding,
        text,
        className,
      )}
    >
      {children}
      <span className={cn('inline-flex items-center justify-center rounded-full bg-accent text-accent-foreground', ring)}>
        <ArrowRight className="size-3.5" />
      </span>
    </Link>
  )
}
```

導出後在 page.tsx 用 `<PrimaryCtaLink>` 取代 `<PrimaryCta>` + `<Link>`。

- [ ] **Step 3: 加 PrimaryCtaLink 到 primary-cta.tsx**

把 Task 7 的檔尾加上面的 `PrimaryCtaLink` 區塊（記得 import `Link from 'next/link'` 與 `ArrowRight from 'lucide-react'`）。

- [ ] **Step 4: typecheck + dev visual check**

```bash
npm run typecheck
npm run dev
```
打開 `/demo-lin-coach`（或 seed 教練 slug）—— 看 hero / bio / video / gallery / services 是否視覺正確，三斷點不破版。

- [ ] **Step 5: Commit**

```bash
git add "src/app/[tenantSlug]/page.tsx" src/components/ui/primary-cta.tsx
git commit -m "$(cat <<'EOF'
feat(s6): public page Direction C — hero/bio/video/gallery/services rebuilt

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: SlotPicker — month calendar grid

**Files:**
- Modify: `src/app/[tenantSlug]/slot-picker.tsx`

**Reference:** `claudeDesign/student/atoms.jsx::SlotPicker` 與 `student/page-public.jsx` 的 slot picker section。

- [ ] **Step 1: Read existing slot-picker.tsx**

理解既有 SlotPicker（'use client'）的 state、props、fetch logic — **保留所有 server-side / client-side data flow**。只重畫月曆 grid + time chips。

- [ ] **Step 2: 替換 render 結構**

把 SlotPicker render JSX 改為兩段：
1. 月曆 nav + month grid（7 col × 6 row、每格今天用黃圓、selected 反白 + 底部 3px accent、可預約日期 footer 顯示 N 個時段、無時段日期 disabled muted bg）
2. 選定日期下方顯示 H4 大日期 + Slot grid（mobile 2 col / desktop 5 col；每個 slot chip 顯示時間 + 狀態 mono）

完整 render 結構參考 `claudeDesign/student/atoms.jsx::SlotPicker` lines 475~696。將 mock dates 替換為從 props / fetch 取得的真實日期，將 mock SLOTS 替換為實際抓的 slots。

關鍵 className：
- 月曆容器：`rounded-2xl border border-border bg-card overflow-hidden`
- weekday header：`grid grid-cols-7 bg-muted border-b border-border` + 每格 `font-mono text-[10.5px] uppercase tracking-[0.15em] px-3 py-2.5`
- 日期 button：`h-[84px] sm:h-[84px] flex flex-col items-stretch justify-between gap-1 p-3 border-r border-b border-border` + 條件樣式（today / selected / disabled）
- selected 底部條：`absolute inset-x-0 bottom-0 h-[3px] bg-accent`
- Slot chip：`h-16 rounded-xl border border-border bg-card p-2.5 flex flex-col items-start justify-center gap-1`
- Slot chip selected：`bg-foreground text-background border-foreground` + 右上 size-4 accent ✓ 圓
- Slot chip full：`opacity-55 cursor-not-allowed bg-muted`

- [ ] **Step 3: typecheck + dev**

```bash
npm run typecheck
npm run dev
```
切到公開頁、看 slot picker 是否正常 render，選日期、選時段、跳 `/book/[slotId]` 都還能用。

- [ ] **Step 4: Commit**

```bash
git add "src/app/[tenantSlug]/slot-picker.tsx"
git commit -m "$(cat <<'EOF'
feat(s6): SlotPicker month calendar grid + time chip visual rebuild

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: `/[tenantSlug]/packages` + purchase form

**Files:**
- Modify: `src/app/[tenantSlug]/packages/page.tsx`
- Modify: `src/app/[tenantSlug]/packages/purchase-request-form.tsx`

**Reference:** `claudeDesign/student/page-packages.jsx`

- [ ] **Step 1: Read reference**

看 page-packages.jsx — 注意 header（kicker / 大標 / 中文 / 描述）、packages 按服務分組（service 名做 SectionHead）、每張卡（含「PER LESSON」mono label、堂數大字 display、價格 display）、popular tag、申請表單展開動畫、空狀態。

- [ ] **Step 2: 重寫 page.tsx render**

保留現有 server-side data fetching；改 hero + 卡片視覺。Header 用 `<SectionHead>` 大字、未登入 AuthCta 用 PrimaryCtaLink。

每張 package card 大致：
```tsx
<div className="rounded-2xl border border-border bg-card p-6 relative">
  {p.popular && <Badge variant="yellow" className="absolute top-4 right-4">熱門</Badge>}
  <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">PACKAGE</div>
  <h3 className="font-display font-cjk mt-2 text-2xl">{p.name}</h3>
  <div className="font-display mt-4 text-4xl">{p.class_count} <span className="text-base text-muted-foreground">堂</span></div>
  <div className="font-mono mt-1 text-xs text-muted-foreground">{p.expires_in_days ? `${p.expires_in_days} 天內上完` : '永久有效'}</div>
  <div className="mt-6 flex items-baseline justify-between border-t border-dashed border-border pt-4">
    <span className="font-mono text-[11px] text-muted-foreground">PER LESSON · NT$ {(p.price / p.class_count).toFixed(0)}</span>
    <span className="font-display border-b-[3px] border-accent pb-px text-2xl">NT$ {p.price.toLocaleString()}</span>
  </div>
  <div className="mt-4">
    <PurchaseRequestForm packageId={p.id} />
  </div>
</div>
```

- [ ] **Step 3: 重寫 purchase-request-form.tsx**（保留 server action wiring）

主按鈕用 PrimaryCta、表單欄位用新 className（h-12 rounded-xl border-2）。

- [ ] **Step 4: typecheck + Commit**

```bash
npm run typecheck
git add "src/app/[tenantSlug]/packages/page.tsx" "src/app/[tenantSlug]/packages/purchase-request-form.tsx"
git commit -m "$(cat <<'EOF'
feat(s6): packages page Direction C — card style + PrimaryCta submit

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: `/book/[slotId]` 預約確認頁

**Files:**
- Modify: `src/app/book/[slotId]/page.tsx`

**Reference:** `claudeDesign/student/page-book.jsx`

- [ ] **Step 1: Read reference**

看 page-book.jsx — 注意 hero（大日期 / 服務名）、套裝餘額卡片、提交區用 PrimaryCta、改期模式 alert。

- [ ] **Step 2: 重寫 render**

保留現有 server-side data fetching + booking action。重要 elements：
- Hero：`<SectionHead kicker="BOOKING · 預約確認" title={服務名} eng="" hint={日期時間} />`
- 套裝餘額：`<Card>` 列出 user 在此 tenant 下的 active purchases，每個顯示 N/M 餘額；無餘額時顯示警示 + 「先購買套裝」`<PrimaryCtaLink>` 到 `/[slug]/packages`
- 確認 button：`<PrimaryCta>確認預約</PrimaryCta>` full width

- [ ] **Step 3: typecheck + Commit**

```bash
npm run typecheck
git add "src/app/book/[slotId]/page.tsx"
git commit -m "$(cat <<'EOF'
feat(s6): /book/[slotId] Direction C — hero + balance card + PrimaryCta

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: `/(customer)/my-bookings` 學員預約列表

**Files:**
- Modify: `src/app/(customer)/my-bookings/page.tsx`

**Reference:** `claudeDesign/student/page-bookings.jsx`

- [ ] **Step 1: 重寫 render**

保留現有 server-side data fetching；換新視覺。Key：
- Header：`<SectionHead title="我的預約" eng="MY BOOKINGS" />` + filter chip group（月份 / 狀態，mono uppercase）
- 預約分組顯示（今日 / 本週 / 之後 / 已過），每組標題 `font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground`
- 每張預約 card：`bg-card border border-border rounded-2xl p-5` + `<StatusBadge status={...}>` + 教練名 + 服務名 + 日期時間（display font）+ 操作按鈕 row（改期 / 取消）

- [ ] **Step 2: typecheck + Commit**

```bash
npm run typecheck
git add "src/app/(customer)/my-bookings/page.tsx"
git commit -m "$(cat <<'EOF'
feat(s6): /my-bookings Direction C — group by time + StatusBadge

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Coach sidebar nav + (tenant) layout

**Files:**
- Modify: `src/app/(tenant)/sidebar-nav.tsx`
- Modify: `src/app/(tenant)/layout.tsx`

**Reference:** `claudeDesign/coach/atoms.jsx` 與 `coach/app.jsx`（sidebar + main shell）

- [ ] **Step 1: Read reference**

看 coach/atoms.jsx 的 Sidebar 元件：dark sidebar bg、QRMark + 教練名、nav items + badge count、bottom theme toggle + 登出。

- [ ] **Step 2: 重寫 sidebar-nav.tsx**

主要結構：
```tsx
<aside className="fixed inset-y-0 left-0 hidden w-[240px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
  <div className="flex items-center gap-3 px-5 py-5">
    <QRMark size={36} />
    <div className="leading-tight">
      <div className="font-display text-base uppercase tracking-wider">QuickReserve</div>
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] opacity-70">BOOK · YOUR · COACH</div>
    </div>
  </div>
  {/* user card */}
  <div className="mx-4 mb-6 mt-2 rounded-2xl border border-sidebar-border bg-sidebar-accent p-3 flex items-center gap-3">
    <div className="size-9 rounded-full bg-accent text-accent-foreground grid place-items-center font-display text-base">
      {tenant.name.slice(0, 1)}
    </div>
    <div className="min-w-0">
      <div className="font-cjk truncate text-sm font-semibold">{tenant.name}</div>
      <div className="font-mono text-[10px] uppercase tracking-wider opacity-60">{role}</div>
    </div>
  </div>
  {/* nav */}
  <nav className="flex-1 space-y-1 px-3">
    {items.map((item) => (
      <Link key={item.href} href={item.href} className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
        pathname === item.href ? 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold' : 'hover:bg-sidebar-accent'
      )}>
        <item.Icon className="size-4" />
        <span className="font-cjk">{item.label}</span>
        {item.badge && <Badge variant="yellow" className="ml-auto">{item.badge}</Badge>}
      </Link>
    ))}
  </nav>
  {/* bottom: theme toggle + logout */}
  <div className="border-t border-sidebar-border p-4 space-y-3">
    <ThemeToggle className="w-full justify-center" />
    <form action={logoutAction}>
      <Button type="submit" variant="ghost" size="lg" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent">
        <LogOut className="size-4" />
        <span className="font-cjk">登出</span>
      </Button>
    </form>
  </div>
</aside>
```

加 mobile 抽屜版本（同樣結構，但 `<aside>` 是 `<Sheet>` 觸發；漢堡 button 在 top bar）。

- [ ] **Step 3: 重寫 (tenant)/layout.tsx**

加 mobile top bar（漢堡 + QRMark + 教練名），桌機隱藏；main 區留 `lg:pl-[240px]` padding。

- [ ] **Step 4: typecheck + Commit**

```bash
npm run typecheck
git add "src/app/(tenant)/sidebar-nav.tsx" "src/app/(tenant)/layout.tsx"
git commit -m "$(cat <<'EOF'
feat(s6): (tenant) sidebar nav Direction C — QRMark + theme toggle

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: `/dashboard` 教練首頁

**Files:**
- Modify: `src/app/(tenant)/dashboard/page.tsx`

**Reference:** `claudeDesign/coach/page-dashboard.jsx`

- [ ] **Step 1: 重寫 page**

保留現有 server-side data fetching（如有），擴充必要 query（KPI 數據、今日預約、待確認列表）。

頁面結構：
- 早安問候 hero：`<SectionHead kicker="DASHBOARD · 今日總覽" title={`早安，${tenantName}`} eng={format(today, 'EEE · MMM dd')} />`
- KPI 卡 4 個：每個 `<Card>` 含 mono label + 大數字（display）+ 差異 vs 上週百分比
- 「今日預約」list 區：`<SectionHead title="今日" eng="TODAY" />` + 預約 card list（時間 / 學員 / 服務 / 狀態 badge）
- 「待確認預約」list：`<SectionHead title="待確認" eng="PENDING" />` + cards with 確認 / 拒絕 button row
- 快速 action：3 個大型 link card（建立可用時段 / 查行事曆 / 開放新套裝）

- [ ] **Step 2: typecheck + Commit**

```bash
npm run typecheck
git add "src/app/(tenant)/dashboard/page.tsx"
git commit -m "$(cat <<'EOF'
feat(s6): /dashboard Direction C — KPI + today + pending + quick actions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 19: `/calendar` 主頁 + 三視圖 + popover

**Files:**
- Modify: `src/app/(tenant)/calendar/page.tsx`
- Modify: `src/app/(tenant)/calendar/calendar-panel.tsx`
- Modify: `src/app/(tenant)/calendar/week-grid.tsx`
- Modify: `src/app/(tenant)/calendar/list-view.tsx`
- Modify: `src/app/(tenant)/calendar/month-view.tsx`（若存在）
- Modify: `src/app/(tenant)/calendar/slot-popover.tsx`

**Reference:** `claudeDesign/coach/page-calendar.jsx`

- [ ] **Step 1: Read reference**

看 page-calendar.jsx —— 注意 header（日期 nav + 視圖切換 segmented control + 教練 filter chips）、week view（7 col × time row、slot card 含 student initial + 衝突 badge + N/M 團班徽章）、list view（按日期分組）、month view（月曆 + 每日 slot 數量點）、popover（時段詳情 + 預約者 list + 操作）。

- [ ] **Step 2: 改 page.tsx + sub-components**

保留所有 server-side data fetching + slot mutation action wiring。重畫：
- Header 用 `<SectionHead>` 雙語 + 日期 nav button
- 視圖切換：`<Tabs>` 或 segmented control（`bg-foreground text-background` for active）
- Week grid：每個 cell `bg-card border border-border rounded-xl` + 「2/4」徽章 yellow pill + 衝突 badge red
- Popover：`bg-card border border-border rounded-2xl shadow-lg p-5` 內含 `<SectionHead>` 小型 + 預約者 avatar row + 操作 button group

- [ ] **Step 3: typecheck + Commit**

```bash
npm run typecheck
git add "src/app/(tenant)/calendar/"
git commit -m "$(cat <<'EOF'
feat(s6): /calendar Direction C — week/list/month + slot popover

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 20: `/services` + `/customers`（合併、CRUD 表格類）

**Files:**
- Modify: `src/app/(tenant)/services/page.tsx`
- Modify: `src/app/(tenant)/services/service-form-dialog.tsx`
- Modify: `src/app/(tenant)/customers/page.tsx`

**Reference:** `claudeDesign/coach/page-services-customers.jsx`

- [ ] **Step 1: 改 services page**

頁面結構：
- `<SectionHead title="服務管理" eng="SERVICES" right={<Button variant="accent">新增服務</Button>} />`
- Tab：使用中 / 已刪除 — 用 segmented control
- 卡片網格：每張 service card 黑底 hover、`<StatusBadge>` for 是否啟用、編輯 / 刪除按鈕

service-form-dialog.tsx 更新表單欄位視覺（rounded-xl border-2）+ 提交用 PrimaryCta。

- [ ] **Step 2: 改 customers page**

- `<SectionHead title="學員管理" eng="CUSTOMERS" />`
- Filter + search bar
- 學員列表 table-like cards：avatar + 名字 + email + 累積預約 + 套裝餘額 + 「查看詳情」

- [ ] **Step 3: typecheck + Commit**

```bash
npm run typecheck
git add "src/app/(tenant)/services/" "src/app/(tenant)/customers/"
git commit -m "$(cat <<'EOF'
feat(s6): /services + /customers Direction C visuals

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 21: `/packages` + `/packages/pending`（合併）

**Files:**
- Modify: `src/app/(tenant)/packages/page.tsx`
- Modify: `src/app/(tenant)/packages/package-form-dialog.tsx`
- Modify: `src/app/(tenant)/packages/package-actions-row.tsx`
- Modify: `src/app/(tenant)/packages/pending/page.tsx`
- Modify: `src/app/(tenant)/packages/pending/purchase-row.tsx`

**Reference:** `claudeDesign/coach/page-packages.jsx`

- [ ] **Step 1: 改 packages page**（CRUD 套裝）

- `<SectionHead title="套裝管理" eng="PACKAGES" right={<Button variant="accent">新增套裝</Button>} />`
- 按 service 分組 H3（中文服務名 + mono 數字 02 等）
- 每張 package card：堂數大字 + 期限 mono + 價格 display + 編輯 / 刪除 inline

- [ ] **Step 2: 改 pending page**

- `<SectionHead title="套裝申請審核" eng="PENDING" />`
- 每筆 pending：學員 avatar + 名字 / 套裝資訊 / 自報付款狀態 / 同意 (accent button) / 拒絕 (outline destructive)
- 空狀態 mono uppercase

- [ ] **Step 3: typecheck + Commit**

```bash
npm run typecheck
git add "src/app/(tenant)/packages/"
git commit -m "$(cat <<'EOF'
feat(s6): /packages + /packages/pending Direction C visuals

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 22: `/notifications` 通知列表

**Files:**
- Modify: `src/app/(tenant)/notifications/page.tsx`（若存在；否則 sub-task pass）

- [ ] **Step 1: 改 page**

- `<SectionHead title="通知" eng="NOTIFICATIONS" />`
- 列表 group by day（今日 / 昨日 / 本週 / 更早）
- 每筆通知 row：icon + 內容 + 時間 mono + 未讀 dot

- [ ] **Step 2: typecheck + Commit**

```bash
npm run typecheck
git add "src/app/(tenant)/notifications/"
git commit -m "$(cat <<'EOF'
feat(s6): /notifications Direction C — grouped list with mono timestamps

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 23: `/settings/profile` visual refresh（保留 S5 結構）

**Files:**
- Modify: `src/app/(tenant)/settings/profile/profile-form.tsx`
- Modify: `src/app/(tenant)/settings/profile/avatar-uploader.tsx`
- Modify: `src/app/(tenant)/settings/profile/video-input.tsx`
- Modify: `src/app/(tenant)/settings/profile/photo-gallery-manager.tsx`
- Modify: `src/app/(tenant)/settings/profile/bio-editor.tsx`

**Reference:** `claudeDesign/coach/page-settings-profile.jsx`

- [ ] **Step 1: profile-form.tsx 視覺改造**

保留 6 個 section 結構 + sticky save bar。改：
- 每 section 標題用 `<SectionHead kicker="..." title="..." eng="..." />` 小型版本（mb-4 而非 mb-6）
- Input 都改 `h-12 rounded-xl border-2 border-border bg-background px-4 font-cjk`
- Sticky save 用 `<PrimaryCta>儲存所有變更</PrimaryCta>`
- Section 之間加更大空隙 + dashed border 區隔

- [ ] **Step 2: 子元件視覺微調**

- AvatarUploader：dropzone 用 `border-dashed border-2 border-border rounded-2xl p-8`、上傳按鈕用 `<Button variant="accent">`
- VideoInput：input 同 form style、preview iframe wrap 用 `rounded-2xl overflow-hidden`
- PhotoGalleryManager：grid 卡片用 `<Card>` 樣式，每張縮圖 `aspect-square rounded-xl`
- BioEditor：toolbar `<div class="border border-border rounded-t-xl bg-muted p-2">`，editor area `border-x border-b border-border rounded-b-xl p-4`

- [ ] **Step 3: typecheck + Commit**

```bash
npm run typecheck
git add "src/app/(tenant)/settings/profile/"
git commit -m "$(cat <<'EOF'
feat(s6): /settings/profile Direction C visual refresh (S5 structure preserved)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 24: `/settings/notifications` + `/calendar/availability` + `/calendar/rules`（合併設定區）

**Files:**
- Modify: `src/app/(tenant)/settings/notifications/page.tsx`
- Modify: `src/app/(tenant)/calendar/availability/page.tsx` + 子元件
- Modify: `src/app/(tenant)/calendar/rules/page.tsx` + 子元件

**Reference:** `claudeDesign/coach/page-settings-notifications.jsx`, `page-availability.jsx`, `page-rules.jsx`

- [ ] **Step 1: notifications/page.tsx**

- Header `<SectionHead title="通知偏好" eng="NOTIFICATIONS" />`
- Toggle 列表 card style：每個事件一行（左 label + 描述 / 右 switch）+ Web Push 訂閱 card 在上方
- 「預約前 N 分鐘」用 input + 分鐘單位

- [ ] **Step 2: availability/page.tsx**

- Header `<SectionHead title="作息模板" eng="AVAILABILITY" />`
- 模板列表 card + 新增 button
- 編輯模板表單：週幾 chip group（mono uppercase）+ 時段範圍 row + 套用範圍 select
- 不可用事件 section
- materialize 預覽（slot list）

- [ ] **Step 3: rules/page.tsx**

- Header `<SectionHead title="重複規則" eng="RULES" />`
- 規則列表 card
- 新增規則表單：重複類型 radio button group + 對應動態欄位 + 結束條件 + 衝突偵測結果

- [ ] **Step 4: typecheck + Commit**

```bash
npm run typecheck
git add "src/app/(tenant)/settings/notifications/" "src/app/(tenant)/calendar/availability/" "src/app/(tenant)/calendar/rules/"
git commit -m "$(cat <<'EOF'
feat(s6): settings/notifications + calendar/availability + calendar/rules Direction C

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 25: README + spec appendix C

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md`

- [ ] **Step 1: README 加 3 節**

在 `## 部署` 之前插入：

```markdown
## 主題與字型（S6）

- **設計方向：** Direction C · Bold Stripe — B&W + 鮮黃 accent，運動健身房氣質
- **字型：**
  - Display: Anton（uppercase, condensed bold）
  - Sans: Space Grotesk
  - CJK: Noto Sans TC（中文混排）
  - Mono: Space Mono（kicker / 標籤）
  - 全部由 `next/font/google` 載入、subsetted、`display: swap`
- **Token：** OKLCH light + dark 兩套，全程保留 shadcn token 名（`--primary`, `--accent`, `--secondary`, `--muted`, `--card`, `--border`, `--sidebar-*`）；`--radius: 0.75rem`
- **顏色搭配：**
  - Light: 白底 + 接近黑 primary + 鮮黃 accent
  - Dark: 深黑底 + 鮮黃 primary（accent 同色）+ 灰階階層

## Dark mode（S6）

- 使用 `next-themes@0.4.6`，`<html class="dark">` 控制
- 切換 UI：`<ThemeToggle>` 三態（日/夜/系統），位於：
  - 後台 sidebar 底部
  - 公開頁與 auth header 右側
- `prefers-color-scheme` 由 `enableSystem` 支援

## Design language（S6）

- `<SectionHead>` 雙語標題（kicker / 中文 / 英文 + accent 底線）— 統一所有 section 開頭
- `<PrimaryCta>` 黑底 + 鮮黃箭頭圈 — 主要 CTA（主要行動點）
- `<Badge>` 5 variant（yellow / black / outline / mutedOutline / neutral）+ `<StatusBadge>` 4 狀態
- `<QRMark>` 自訂 logo（鮮黃扇形 + 白圈）
- 字型 className：`font-display`（大標）/ `font-mono`（標籤）/ `font-cjk`（中文段落）— 全 `globals.css` 定義
```

- [ ] **Step 2: spec appendix C 加 FR-137~143**

打開 spec，找到附錄 C table 末端（前面是 FR-131~136），append 6 行（先用 placeholder hash，最後再 backfill）：

```markdown
| 2026-05-27 | CJK 字型導入（Noto Sans TC）+ next/font 4 套整合 | FR-137 | `<FILL>` |
| 2026-05-27 | 主題色重組（Direction C · Bold Stripe，B&W + 鮮黃 accent） | FR-138 | `<FILL>` |
| 2026-05-27 | next-themes wire + ThemeToggle（light/dark/system 三態） | FR-139 | `<FILL>` |
| 2026-05-27 | 跨頁 UI 一致化（QRMark / PrimaryCta / SectionHead / Badge primitive） | FR-140 | `<FILL>` |
| 2026-05-27 | RWD 三斷點完備（mobile/tablet/desktop 全頁面通過） | FR-141 | `<FILL>` |
| 2026-05-27 | micro-interaction polish（hover/focus/skeleton） | FR-142 | `<FILL>` |
| 2026-05-27 | a11y 基線（AA 對比 / focus ring / reduced-motion / 44×44 點擊區） | FR-143 | `<FILL>` |
```

頂部 最後更新 line 加 S6 entry：「2026-05-27（S6 設計重整：FR-137~143 — Direction C tokens、CJK 字型、Dark mode、跨頁 primitive、RWD、a11y）；...」（保留既有 entries）

- [ ] **Step 3: Commit 1（含 placeholder）**

```bash
git add README.md docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md
git commit -m "$(cat <<'EOF'
docs(s6): README theme + dark mode + design language sections + spec FR-137~143

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Backfill commit hash**

```bash
HASH=$(git log --oneline -1 | awk '{print $1}')
sed -i "s/<FILL>/$HASH/g" docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md
git add docs/superpowers/specs/2026-05-21-quickreserve-redesign-design.md
git commit -m "$(cat <<'EOF'
docs(s6): backfill commit hash in spec appendix C

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 26: Final verify + RWD + a11y check + push + Vercel READY

- [ ] **Step 1: Full verify gate**

```bash
npm run typecheck
npm test
npm run lint
npm run build
```
Expected: typecheck PASS、test 70+ PASS、lint warnings only、build PASS。

- [ ] **Step 2: 三斷點 visual smoke test**

`npm run dev`，逐頁開啟、用 Chrome DevTools Device Toolbar 切：
- iPhone SE (375px) — mobile
- iPad (768px) — tablet
- 1280px desktop

頁面清單：
- `/login` `/signup`
- `/<seed-tenant-slug>`（demo-lin-coach 或實際 seed）
- `/<slug>/packages`
- `/book/<some-slot-id>`
- `/my-bookings`（登入後）
- `/dashboard`（教練登入）
- `/calendar`、`/calendar/availability`、`/calendar/rules`
- `/services`、`/customers`、`/packages`、`/packages/pending`
- `/settings/profile`、`/settings/notifications`、`/notifications`

每頁過：(a) 不破版 (b) 字型載入 (c) PrimaryCta 顯示正常 (d) hover 互動順 (e) 切 dark mode 全頁可用、無 hard-coded color 沒被切換的破洞。

- [ ] **Step 3: a11y check（Lighthouse）**

Chrome DevTools → Lighthouse → mobile + a11y only → run 對主要頁面（公開頁 / dashboard / settings/profile）。Expected: a11y ≥ 95。修任何 critical issue（focus / 對比 / aria-label）。

- [ ] **Step 4: Push origin master**

```bash
git push origin master
```

- [ ] **Step 5: 等 Vercel READY**

Vercel 應自動 deploy（cron limit 已在 S5 末段修，沒新增 hourly cron 違反 limit）。透過 API poll：

```bash
HEAD=$(git rev-parse HEAD)
until curl -s -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com/v6/deployments?limit=1&target=production" | grep -q "\"githubCommitSha\":\"$HEAD"; do
  sleep 15
done
echo "deploy registered, waiting for READY..."
DEPLOY_ID=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com/v6/deployments?limit=1&target=production" | python -c "import sys,json; print(json.load(sys.stdin)['deployments'][0]['uid'])")
until [ "$(curl -s -H \"Authorization: Bearer $VERCEL_TOKEN\" https://api.vercel.com/v13/deployments/$DEPLOY_ID | python -c \"import sys,json; print(json.load(sys.stdin)['readyState'])\")" = "READY" ]; do
  sleep 20
done
echo "READY!"
```

（VERCEL_TOKEN 從使用者 session 提供的 vcp_ 開頭 token；如未提供請使用者貼）

- [ ] **Step 6: 通知使用者完成**

回報：「S6 完成、X commits 已 push、Vercel READY、Direction C 套用完成。下一步可進 S7（架構/資安 review）。」

---

## Self-Review

**Spec coverage：**

| Spec § | 內容 | Task 對應 |
|---|---|---|
| FR-137 CJK 字型 | Noto Sans TC + next/font | Task 3 (layout.tsx) |
| FR-138 主題色 | OKLCH Direction C tokens | Task 4 (globals.css) |
| FR-139 Dark mode toggle | next-themes + ThemeToggle | Task 2 + Task 5 + Task 17 (in sidebar) + Task 11 (in auth header) |
| FR-140 跨頁 UI 一致 | QRMark / PrimaryCta / SectionHead / Badge | Task 6 + 7 + 8 + 9 + 10 + 全頁 task |
| FR-141 RWD 三斷點 | mobile/tablet/desktop 全頁過 | 全頁 task 內含；Task 26 step 2 驗收 |
| FR-142 micro-interaction | hover/focus/skeleton | 由元件 className 提供，全頁 task 套用 |
| FR-143 a11y | AA / focus ring / reduced-motion | className 帶 focus-visible 與 aria-*；Task 26 step 3 Lighthouse 驗 |
| §6.1 Shadcn token 不換名 | tokens.css 與 globals.css 對齊 | Task 4 |
| §6.2 Dark mode 完整 | .dark block | Task 4 |
| §6.3 CJK 字型 | layout.tsx | Task 3 |
| §6.4 RWD 三斷點 | 全頁套 | 全頁 task |
| §6.5 a11y 基線 | className + Lighthouse | Task 26 |
| §7 檔案異動 | foundation + pages + docs | 涵蓋 |
| §8 風險 | shadcn token 鎖死 / CJK LCP / hard-coded color | Task 4 鎖名 / Task 3 preload:false / Task 26 grep |
| §9 doc 更新 | README + 附錄 C | Task 25 |

**Placeholder scan：** 唯一 `<FILL>` 在 Task 25 step 2 設計上的 commit-hash placeholder，由 Task 25 step 4 backfill。其他無 TBD / TODO。

**Type consistency：**
- `<PrimaryCta>` 全 task 用同一 import path
- `<PrimaryCtaLink>` 在 Task 12 step 3 加進 primary-cta.tsx 後被多 task 引用
- `<SectionHead>` props 一致（kicker / title / eng / hint / right）
- `<StatusBadge status="pending|confirmed|cancelled|completed">` 統一
- 字型 className `font-display` / `font-cjk` / `font-mono` 在 globals.css Task 4 定義後全 task 引用

無 inconsistency。

**Scope check:** 範圍合理（26 tasks，類似 S4 規模），不需要拆 sub-plan。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-27-s6-design-refresh.md`. 共 26 個 task。

兩種執行方式：

**1. Subagent-Driven（建議，與 S2~S5 同模式）** — 每 task 派新 sonnet subagent 實作 + spec reviewer + code quality reviewer，主 session checkpoint review

**2. Inline Execution** — 在當前 session batch 執行，遇 checkpoint 才停

要走哪個？
