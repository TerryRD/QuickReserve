'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireTenantOwner } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError, NotFoundError } from '@/lib/errors'

const PriceSchema = z.coerce.number().nonnegative().nullable()

const CreateServiceSchema = z.object({
  name: z.string().min(1, '請輸入名稱').max(60),
  description: z.string().max(500).optional().nullable(),
  durationMinutes: z.coerce.number().int().positive().max(600),
  price: PriceSchema,
  maxCapacity: z.coerce.number().int().positive().default(1),
  minAttendance: z.coerce.number().int().positive().default(1),
  cancelDeadlineHours: z.coerce.number().int().min(1).default(24),
})

const CreateServiceSchemaRefined = CreateServiceSchema.refine(
  (v) => v.minAttendance <= v.maxCapacity,
  { message: '最少人數不能大於最大人數', path: ['minAttendance'] },
)

export const createServiceAction = actionClient
  .inputSchema(CreateServiceSchemaRefined)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantOwner()
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('services')
      .insert({
        tenant_id: session.tenantId,
        name: parsedInput.name,
        description: parsedInput.description ?? null,
        duration_minutes: parsedInput.durationMinutes,
        price: parsedInput.price,
        is_active: true,
        max_capacity: parsedInput.maxCapacity,
        min_attendance: parsedInput.minAttendance,
        cancel_deadline_hours: parsedInput.cancelDeadlineHours,
      })
      .select('id')
      .single()
    if (error || !data) throw new AppError('SERVICE_CREATE_FAILED', error?.message ?? '建立失敗')
    revalidatePath('/services')
    return { id: data.id }
  })

const UpdateServiceSchema = CreateServiceSchema.extend({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
}).refine((v) => v.minAttendance <= v.maxCapacity, {
  message: '最少人數不能大於最大人數',
  path: ['minAttendance'],
})

export const updateServiceAction = actionClient
  .inputSchema(UpdateServiceSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantOwner()
    const supabase = await createSupabaseServerClient()
    const { data: existing } = await supabase
      .from('services')
      .select('tenant_id')
      .eq('id', parsedInput.id)
      .maybeSingle()
    if (!existing) throw new NotFoundError('服務')
    if (existing.tenant_id !== session.tenantId) throw new NotFoundError('服務')

    const { error } = await supabase
      .from('services')
      .update({
        name: parsedInput.name,
        description: parsedInput.description ?? null,
        duration_minutes: parsedInput.durationMinutes,
        price: parsedInput.price,
        is_active: parsedInput.isActive ?? true,
        max_capacity: parsedInput.maxCapacity,
        min_attendance: parsedInput.minAttendance,
        cancel_deadline_hours: parsedInput.cancelDeadlineHours,
      })
      .eq('id', parsedInput.id)
    if (error) throw new AppError('SERVICE_UPDATE_FAILED', error.message)
    revalidatePath('/services')
    return { id: parsedInput.id }
  })

const DeactivateSchema = z.object({ id: z.string().uuid() })

export const softDeleteServiceAction = actionClient
  .inputSchema(DeactivateSchema)
  .action(async ({ parsedInput }) => {
    await requireTenantOwner()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('services')
      .update({ is_active: false })
      .eq('id', parsedInput.id)
    if (error) throw new AppError('SERVICE_DELETE_FAILED', error.message)
    revalidatePath('/services')
    return { ok: true }
  })

export const restoreServiceAction = actionClient
  .inputSchema(DeactivateSchema)
  .action(async ({ parsedInput }) => {
    await requireTenantOwner()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('services')
      .update({ is_active: true })
      .eq('id', parsedInput.id)
    if (error) throw new AppError('SERVICE_RESTORE_FAILED', error.message)
    revalidatePath('/services')
    return { ok: true }
  })
