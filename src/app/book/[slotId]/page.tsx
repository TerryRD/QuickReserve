import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Calendar, Clock, DollarSign, ArrowLeft } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/get-session'
import { Card, CardContent } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import BookForm from './book-form'

const TZ_OFFSET_HOURS = 8
const toLocal = (iso: string) => new Date(new Date(iso).getTime() + TZ_OFFSET_HOURS * 3600 * 1000)

export default async function BookConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ slotId: string }>
  searchParams: Promise<{ reschedule?: string }>
}) {
  const { slotId } = await params
  const { reschedule: rescheduleFrom } = await searchParams
  const supabase = await createSupabaseServerClient()

  const { data: slot } = await supabase
    .from('availability_slots')
    .select(
      'id, start_at, end_at, status, tenants(name, slug), services(name, duration_minutes, price)',
    )
    .eq('id', slotId)
    .maybeSingle()
  if (!slot) notFound()
  if (slot.status !== 'available') {
    const tenant = slot.tenants as { slug: string } | null
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-2xl">
              ⚠️
            </div>
            <h2 className="mt-4 text-lg font-semibold">此時段已不可預約</h2>
            <p className="mt-1 text-sm text-muted-foreground">該時段可能已被其他學員預約或取消。</p>
            {tenant && (
              <Link
                href={`/${tenant.slug}`}
                className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' mt-6 inline-flex'}
              >
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> 回教練頁
              </Link>
            )}
          </CardContent>
        </Card>
      </main>
    )
  }

  const session = await getSession()
  if (!session) {
    redirect(`/login?redirect=/book/${slotId}`)
  }

  const tenant = slot.tenants as { name: string; slug: string } | null
  const service = slot.services as {
    name: string
    duration_minutes: number
    price: number | null
  } | null
  const start = toLocal(slot.start_at)
  const end = toLocal(slot.end_at)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <main className="mx-auto max-w-md px-4 py-8">
        {tenant && (
          <Link
            href={`/${tenant.slug}`}
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {tenant.name}
          </Link>
        )}

        <h1 className="text-2xl font-bold tracking-tight">
          {rescheduleFrom ? '確認改期' : '確認預約'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rescheduleFrom ? '送出後將自動取消原預約並改為此時段' : '確認資訊後送出預約申請'}
        </p>
        {rescheduleFrom && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            ⓘ 您正在改期。原預約將被取消，重新建立的新預約狀態為「待確認」。
          </div>
        )}

        <Card className="mt-6 border-2 border-blue-500/20 bg-blue-50/30">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-500 text-white">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">日期時間</div>
                <div className="font-semibold">
                  {format(start, 'yyyy/MM/dd (EEE)')} {format(start, 'HH:mm')}–
                  {format(end, 'HH:mm')}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-blue-500/10 pt-3 text-sm">
              <div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> 服務
                </div>
                <div className="mt-0.5 font-medium">
                  {service?.name} ({service?.duration_minutes} 分)
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <DollarSign className="h-3 w-3" /> 價格
                </div>
                <div className="mt-0.5 font-medium">
                  {service?.price ? `$${Number(service.price).toLocaleString()}` : '洽詢'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6">
          <BookForm slotId={slotId} rescheduleFrom={rescheduleFrom ?? null} />
        </div>
      </main>
    </div>
  )
}
