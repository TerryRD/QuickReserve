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
import { PrimaryCtaLink } from '@/components/ui/primary-cta'
import { SectionHead } from '@/components/ui/section-head'
import { VideoEmbed } from '@/components/public-page/video-embed'
import SlotPicker from './slot-picker'

function deriveEngTitle(slug: string): string {
  // Use the slug as the English display title — uppercase, hyphens to spaces
  return slug.toUpperCase().replace(/-/g, ' ')
}

export default async function TenantPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>
  searchParams: Promise<{ service?: string; date?: string; from?: string; reschedule?: string }>
}) {
  const { tenantSlug } = await params
  const {
    service: selectedServiceId,
    date: selectedDate,
    from: fromOffset,
    reschedule: rescheduleFrom,
  } = await searchParams
  const tenant = await getTenantBySlug(tenantSlug)
  if (!tenant) notFound()

  if (tenant.status === 'suspended') {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-8">
        <div className="max-w-md rounded-2xl border border-border bg-card p-10 text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            SUSPENDED
          </div>
          <h2 className="font-display mt-4 text-2xl uppercase">服務暫停中</h2>
          <p className="font-cjk mt-2 text-sm text-muted-foreground">
            此教練目前不開放預約，請稍後再試。
          </p>
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
          {/* Badge + meta */}
          <div className="mb-6 flex flex-wrap items-center gap-2 sm:mb-8">
            <Badge variant="yellow" icon={<Star className="size-3" />}>
              COACH
            </Badge>
            <span className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground">
              /{tenant.slug}
            </span>
          </div>

          {/* Big English display title (derived from slug) + accent dot */}
          <h1 className="font-display text-[60px] uppercase leading-[0.9] tracking-tight sm:text-[92px] lg:text-[128px]">
            {deriveEngTitle(tenant.slug)}
            <span
              aria-hidden
              className="ml-3 inline-block size-3 rounded-full bg-accent align-baseline sm:size-4"
            />
          </h1>

          {/* 中文 display secondary title + mono COACH label */}
          <div className="mt-3 flex flex-wrap items-baseline gap-3.5 sm:mt-4">
            <span className="font-display font-cjk text-[22px] font-black sm:text-[28px]">
              {tenant.name}
            </span>
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground sm:text-[13px]">
              —— 教練 / COACH
            </span>
          </div>

          {/* Avatar + subtitle */}
          <div className="mt-7 flex max-w-[880px] flex-col items-start gap-5 sm:mt-10 sm:flex-row sm:items-center sm:gap-7">
            {tenant.avatar_url ? (
              <img
                src={tenant.avatar_url}
                alt={tenant.name}
                className="size-[76px] shrink-0 rounded-full border border-border object-cover sm:size-[104px]"
              />
            ) : (
              <div className="font-display grid size-[76px] shrink-0 place-items-center rounded-full border border-border bg-secondary text-2xl sm:size-[104px] sm:text-3xl">
                {tenant.name.slice(0, 1)}
              </div>
            )}
            <p className="font-cjk text-base font-medium leading-relaxed sm:text-lg">
              {tenant.description?.trim() ||
                '在下方選擇您想預訂的服務、日期與時段。送出後狀態為「待確認」，教練確認後即正式成立。'}
            </p>
          </div>

          {/* Contact pills */}
          {(tenant.contact_email ||
            tenant.contact_phone ||
            tenant.contact_line_id ||
            tenant.contact_note) && (
            <div className="mt-7 flex flex-wrap gap-2 sm:mt-8">
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

          {/* Auth CTA — only for visitors */}
          {!session && (
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <PrimaryCtaLink href={`/login?redirect=${encodeURIComponent(returnPath)}`} size="lg">
                登入預約
              </PrimaryCtaLink>
              <Button
                variant="pill-outline"
                size="xl"
                render={<Link href={`/signup?redirect=${encodeURIComponent(returnPath)}`} />}
              >
                建立帳號
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
                <div className="font-cjk text-sm font-bold">
                  改期模式 · 選擇新時段後原預約自動取消
                </div>
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
                    <h3 className="font-display font-cjk text-[22px] font-black leading-tight">
                      {s.name}
                    </h3>
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
