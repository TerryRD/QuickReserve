import { notFound, redirect } from 'next/navigation'
import { format } from 'date-fns'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/get-session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import BookForm from './book-form'

const TZ_OFFSET_HOURS = 8

function toLocal(iso: string): Date {
  return new Date(new Date(iso).getTime() + TZ_OFFSET_HOURS * 3600 * 1000)
}

export default async function BookConfirmPage({
  params,
}: {
  params: Promise<{ slotId: string }>
}) {
  const { slotId } = await params
  const supabase = await createSupabaseServerClient()

  const { data: slot } = await supabase
    .from('availability_slots')
    .select('id, start_at, end_at, status, tenants(name, slug), services(name, duration_minutes, price)')
    .eq('id', slotId)
    .maybeSingle()
  if (!slot) notFound()
  if (slot.status !== 'available') {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>此時段已不可預約</CardTitle>
          </CardHeader>
          <CardContent>請回上一頁選擇其他時段。</CardContent>
        </Card>
      </main>
    )
  }

  const session = await getSession()
  if (!session) {
    redirect(`/login?redirect=/book/${slotId}`)
  }

  const tenant = slot.tenants as { name: string; slug: string } | null
  const service = slot.services as
    | { name: string; duration_minutes: number; price: number | null }
    | null
  const start = toLocal(slot.start_at)
  const end = toLocal(slot.end_at)

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-2xl font-bold">確認預約</h1>
      <Card>
        <CardHeader>
          <CardTitle>{tenant?.name ?? ''}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <span className="text-slate-500">服務：</span>
            {service?.name} ({service?.duration_minutes} 分
            {service?.price ? ` · $${service.price}` : ''})
          </div>
          <div>
            <span className="text-slate-500">時間：</span>
            {format(start, 'yyyy/MM/dd (EEE)')} {format(start, 'HH:mm')}–{format(end, 'HH:mm')}
          </div>
        </CardContent>
      </Card>
      <BookForm slotId={slotId} />
    </main>
  )
}
