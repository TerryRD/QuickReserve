'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireTenantOwner } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError, NotFoundError } from '@/lib/errors'

const CreatePackageSchema = z.object({
  serviceId: z.string().uuid(),
  name: z.string().min(1).max(60),
  classCount: z.coerce.number().int().positive(),
  price: z.coerce.number().nonnegative(),
  expiresInDays: z.coerce.number().int().positive().nullable(),
})

export const createPackageAction = actionClient
  .inputSchema(CreatePackageSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantOwner()
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('service_packages')
      .insert({
        tenant_id: session.tenantId,
        service_id: parsedInput.serviceId,
        name: parsedInput.name,
        class_count: parsedInput.classCount,
        price: parsedInput.price,
        expires_in_days: parsedInput.expiresInDays,
      })
      .select('id')
      .single()
    if (error || !data) throw new AppError('PACKAGE_CREATE_FAILED', error?.message ?? '建立失敗')
    revalidatePath('/packages')
    return { id: data.id }
  })

const UpdatePackageSchema = CreatePackageSchema.extend({ id: z.string().uuid() })

export const updatePackageAction = actionClient
  .inputSchema(UpdatePackageSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantOwner()
    const supabase = await createSupabaseServerClient()
    const { data: existing } = await supabase
      .from('service_packages')
      .select('tenant_id')
      .eq('id', parsedInput.id)
      .maybeSingle()
    if (!existing || existing.tenant_id !== session.tenantId) throw new NotFoundError('套裝')

    const { error } = await supabase
      .from('service_packages')
      .update({
        name: parsedInput.name,
        class_count: parsedInput.classCount,
        price: parsedInput.price,
        expires_in_days: parsedInput.expiresInDays,
        service_id: parsedInput.serviceId,
      })
      .eq('id', parsedInput.id)
    if (error) throw new AppError('PACKAGE_UPDATE_FAILED', error.message)
    revalidatePath('/packages')
    return { ok: true }
  })

const IdSchema = z.object({ id: z.string().uuid() })

export const softDeletePackageAction = actionClient
  .inputSchema(IdSchema)
  .action(async ({ parsedInput }) => {
    await requireTenantOwner()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('service_packages')
      .update({ is_active: false })
      .eq('id', parsedInput.id)
    if (error) throw new AppError('PACKAGE_DELETE_FAILED', error.message)
    revalidatePath('/packages')
    return { ok: true }
  })

export const restorePackageAction = actionClient
  .inputSchema(IdSchema)
  .action(async ({ parsedInput }) => {
    await requireTenantOwner()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('service_packages')
      .update({ is_active: true })
      .eq('id', parsedInput.id)
    if (error) throw new AppError('PACKAGE_RESTORE_FAILED', error.message)
    revalidatePath('/packages')
    return { ok: true }
  })
