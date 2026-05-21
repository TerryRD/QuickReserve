'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { actionClient } from '@/lib/safe-action'
import { requireTenantOwner } from '@/lib/auth/get-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'

const UpdateProfileSchema = z.object({
  name: z.string().min(1, '請填租戶名稱').max(60),
  description: z.string().max(500).optional().nullable(),
  contactEmail: z.string().email().or(z.literal('')).optional().nullable(),
  contactPhone: z.string().max(40).optional().nullable(),
  contactLineId: z.string().max(40).optional().nullable(),
  contactNote: z.string().max(280).optional().nullable(),
})

export const updateTenantProfileAction = actionClient
  .inputSchema(UpdateProfileSchema)
  .action(async ({ parsedInput }) => {
    const session = await requireTenantOwner()
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('tenants')
      .update({
        name: parsedInput.name,
        description: parsedInput.description ?? null,
        contact_email: parsedInput.contactEmail || null,
        contact_phone: parsedInput.contactPhone || null,
        contact_line_id: parsedInput.contactLineId || null,
        contact_note: parsedInput.contactNote || null,
      })
      .eq('id', session.tenantId)
    if (error) throw new AppError('TENANT_UPDATE_FAILED', error.message)
    revalidatePath('/settings/profile')
    revalidatePath('/dashboard')
    return { ok: true }
  })
