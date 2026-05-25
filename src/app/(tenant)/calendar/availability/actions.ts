'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireTenantMember } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'

const WindowSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
})

const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(50),
  windows: z.array(WindowSchema),
})

export const createTemplateAction = actionClient
  .inputSchema(CreateTemplateSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantMember()
    const supabase = await createSupabaseServerClient()

    const { data: template, error: tErr } = await supabase
      .from('availability_templates')
      .insert({ member_id: session.memberId, name: parsedInput.name })
      .select('id')
      .single()
    if (tErr || !template) throw new AppError('TEMPLATE_CREATE_FAILED', tErr?.message ?? '建立失敗')

    if (parsedInput.windows.length > 0) {
      const rows = parsedInput.windows.map((w) => ({
        template_id: template.id,
        weekday: w.weekday,
        start_time: w.start_time,
        end_time: w.end_time,
      }))
      const { error: wErr } = await supabase.from('availability_template_windows').insert(rows)
      if (wErr) {
        await supabase.from('availability_templates').delete().eq('id', template.id)
        throw new AppError('TEMPLATE_WINDOWS_FAILED', wErr.message)
      }
    }

    revalidatePath('/calendar/availability')
    return { templateId: template.id }
  })

const UpdateWindowsSchema = z.object({
  templateId: z.string().uuid(),
  windows: z.array(WindowSchema),
})

export const updateTemplateWindowsAction = actionClient
  .inputSchema(UpdateWindowsSchema)
  .action(async ({ parsedInput }) => {
    await requireTenantMember()
    const supabase = await createSupabaseServerClient()

    const { error: delErr } = await supabase
      .from('availability_template_windows')
      .delete()
      .eq('template_id', parsedInput.templateId)
    if (delErr) throw new AppError('TEMPLATE_WINDOWS_FAILED', delErr.message)

    if (parsedInput.windows.length > 0) {
      const rows = parsedInput.windows.map((w) => ({
        template_id: parsedInput.templateId,
        weekday: w.weekday,
        start_time: w.start_time,
        end_time: w.end_time,
      }))
      const { error } = await supabase.from('availability_template_windows').insert(rows)
      if (error) throw new AppError('TEMPLATE_WINDOWS_FAILED', error.message)
    }

    await supabase
      .from('availability_templates')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', parsedInput.templateId)

    revalidatePath('/calendar/availability')
    return { ok: true }
  })

const RenameSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string().min(1).max(50),
})

export const renameTemplateAction = actionClient
  .inputSchema(RenameSchema)
  .action(async ({ parsedInput }) => {
    await requireTenantMember()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('availability_templates')
      .update({ name: parsedInput.name })
      .eq('id', parsedInput.templateId)
    if (error) throw new AppError('RENAME_FAILED', error.message)
    revalidatePath('/calendar/availability')
    return { ok: true }
  })

const DeleteSchema = z.object({ templateId: z.string().uuid() })

export const deleteTemplateAction = actionClient
  .inputSchema(DeleteSchema)
  .action(async ({ parsedInput }) => {
    await requireTenantMember()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('availability_templates')
      .delete()
      .eq('id', parsedInput.templateId)
    if (error) {
      // FK restrict from assignments → caller must remove assignments first
      if (error.message?.includes('foreign key'))
        throw new AppError('TEMPLATE_IN_USE', '此模板正在使用中，請先切換為其他模板')
      throw new AppError('DELETE_FAILED', error.message)
    }
    revalidatePath('/calendar/availability')
    return { ok: true }
  })

const AssignSchema = z.object({
  templateId: z.string().uuid(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export const assignTemplateAction = actionClient
  .inputSchema(AssignSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantMember()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.from('availability_template_assignments').insert({
      member_id: session.memberId,
      template_id: parsedInput.templateId,
      effective_from: parsedInput.effectiveFrom,
    })
    if (error) throw new AppError('ASSIGN_FAILED', error.message)
    revalidatePath('/calendar/availability')
    return { ok: true }
  })
