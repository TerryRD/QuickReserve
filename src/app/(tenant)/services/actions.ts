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
})

export const createServiceAction = actionClient
  .inputSchema(CreateServiceSchema)
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
      })
      .eq('id', parsedInput.id)
    if (error) throw new AppError('SERVICE_UPDATE_FAILED', error.message)
    revalidatePath('/services')
    return { id: parsedInput.id }
  })

const DeactivateSchema = z.object({ id: z.string().uuid() })

export const deactivateServiceAction = actionClient
  .inputSchema(DeactivateSchema)
  .action(async ({ parsedInput }) => {
    await requireTenantOwner()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('services')
      .update({ is_active: false })
      .eq('id', parsedInput.id)
    if (error) throw new AppError('SERVICE_DEACTIVATE_FAILED', error.message)
    revalidatePath('/services')
    return { ok: true }
  })
