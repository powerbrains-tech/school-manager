'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission } from '../lib/auth'
import { supabase } from '../lib/supabase'

export async function checkInSchool(studentId: string) {
  const access = await requirePermission('edit')
  if (!access.ok) {
    return { success: false, message: access.error }
  }

  const { data: student } = await supabase
    .from('students')
    .select('name, nickname, image_url')
    .eq('student_id', studentId)
    .single()

  if (!student) {
    return { success: false, message: 'ไม่พบรหัสนักเรียนนี้ในระบบ' }
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: existingCheckIn } = await supabase
    .from('daily_checkins')
    .select('id')
    .eq('student_id', studentId)
    .gte('created_at', todayStart.toISOString())
    .maybeSingle()

  if (existingCheckIn) {
    return {
      success: true,
      student,
      isRepeat: true,
      message: 'วันนี้เช็กชื่อไปแล้วครับ',
    }
  }

  const { error } = await supabase.from('daily_checkins').insert([{ student_id: studentId }])

  if (error) {
    return { success: false, message: `บันทึกข้อมูลไม่สำเร็จ: ${error.message}` }
  }

  revalidatePath('/dashboard')
  return { success: true, student, isRepeat: false }
}
