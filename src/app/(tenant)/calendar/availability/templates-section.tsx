import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import TemplateEditor from './template-editor'

export default async function TemplatesSection() {
  const session = await requireTenantMember()
  const supabase = await createSupabaseServerClient()

  const { data: templates } = await supabase
    .from('availability_templates')
    .select('id, name, created_at, updated_at')
    .eq('member_id', session.memberId)
    .order('created_at', { ascending: true })

  const templateIds = (templates ?? []).map((t) => t.id)
  const { data: windows } =
    templateIds.length === 0
      ? { data: [] }
      : await supabase
          .from('availability_template_windows')
          .select('template_id, weekday, start_time, end_time')
          .in('template_id', templateIds)

  const windowsByTemplate: Record<
    string,
    Array<{ weekday: number; start_time: string; end_time: string }>
  > = {}
  for (const w of windows ?? []) {
    windowsByTemplate[w.template_id] = windowsByTemplate[w.template_id] ?? []
    windowsByTemplate[w.template_id]!.push({
      weekday: w.weekday,
      start_time: w.start_time,
      end_time: w.end_time,
    })
  }

  const { data: activeAssign } = await supabase
    .from('availability_template_assignments')
    .select('template_id, effective_from')
    .eq('member_id', session.memberId)
    .lte('effective_from', new Date().toISOString().slice(0, 10))
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()
  const activeTemplateId = activeAssign?.template_id ?? null

  return (
    <div className="space-y-3">
      {(templates ?? []).map((t) => (
        <TemplateEditor
          key={`${t.id}-${t.updated_at}`}
          template={{
            id: t.id,
            name: t.name,
            windows: windowsByTemplate[t.id] ?? [],
          }}
          isActive={t.id === activeTemplateId}
        />
      ))}
      <TemplateEditor template={null} isActive={false} />
      {(templates ?? []).length === 0 && (
        <p className="text-xs text-muted-foreground">
          尚無模板。建立第一個模板後，可指定生效日期、批量設定每週可上課時段。
        </p>
      )}
    </div>
  )
}
