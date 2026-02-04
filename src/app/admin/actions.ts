// src/app/admin/actions.ts
'use server'

import { supabase } from '../lib/supabase'
import { revalidatePath } from 'next/cache'

export async function addHours(formData: FormData) {
  const enrollmentId = formData.get('enrollmentId') as string
  const hoursToAdd = parseInt(formData.get('hours') as string)

  if (!enrollmentId || !hoursToAdd) return

  // 1. ดึงชั่วโมงปัจจุบันก่อน
  const { data: current } = await supabase
    .from('enrollments')
    .select('remaining_hours')
    .eq('id', enrollmentId)
    .single()

  if (!current) return

  // 2. บวกชั่วโมงเพิ่มเข้าไป
  const newHours = (current.remaining_hours || 0) + hoursToAdd

  await supabase
    .from('enrollments')
    .update({ remaining_hours: newHours })
    .eq('id', enrollmentId)

  // 3. สั่งให้หน้าจอรีเฟรชข้อมูลใหม่ทันที
  revalidatePath('/admin')
}