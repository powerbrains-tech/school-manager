'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission } from '../lib/auth'
import { supabase } from '../lib/supabase'

export async function addHours(formData: FormData) {
  const access = await requirePermission('edit')
  if (!access.ok) return

  const enrollmentId = formData.get('enrollmentId') as string
  const hoursToAdd = Number.parseFloat((formData.get('hours') as string) || '0')

  if (!enrollmentId || !Number.isFinite(hoursToAdd) || hoursToAdd <= 0) return

  const { data: current } = await supabase
    .from('enrollments')
    .select('remaining_hours')
    .eq('id', enrollmentId)
    .single()

  if (!current) return

  const newHours = (current.remaining_hours || 0) + hoursToAdd

  await supabase
    .from('enrollments')
    .update({ remaining_hours: newHours })
    .eq('id', enrollmentId)

  revalidatePath('/admin')
  revalidatePath('/dashboard')
}
