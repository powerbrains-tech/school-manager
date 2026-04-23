'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission } from '../lib/auth'
import { CLASS_SESSION_HOURS } from '../lib/constants'
import { supabase } from '../lib/supabase'

export async function getAllSubjects() {
  const access = await requirePermission('edit')
  if (!access.ok) return []

  const { data } = await supabase.from('subjects').select('*').order('id')
  return data || []
}

export async function getStudentTimeBank(studentId: string) {
  const access = await requirePermission('edit')
  if (!access.ok) return { success: false, message: access.error }

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, student_id, name, nickname, image_url')
    .eq('student_id', studentId)
    .single()

  if (studentError || !student) {
    return { success: false, message: 'ไม่พบรหัสนักเรียนนี้ในระบบ' }
  }

  const { data: allEnrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('id, remaining_hours, student_id, courses(title)')
    .eq('student_id', student.id)

  if (enrollError) {
    return { success: false, message: `ดึงข้อมูลคอร์สไม่สำเร็จ: ${enrollError.message}` }
  }

  const validEnrollment = allEnrollments?.find(
    (enrollment) => enrollment.remaining_hours >= CLASS_SESSION_HOURS
  )

  if (!validEnrollment) {
    return { success: false, message: 'ชั่วโมงเรียนคงเหลือไม่พอ' }
  }

  return {
    success: true,
    student,
    enrollment: validEnrollment,
  }
}

export async function deductTimeBank(
  enrollmentId: number,
  currentHours: number,
  subjectId: number
) {
  const access = await requirePermission('edit')
  if (!access.ok) return { success: false, message: access.error }

  if (currentHours < CLASS_SESSION_HOURS) {
    return { success: false, message: 'ชั่วโมงเรียนคงเหลือไม่พอ' }
  }

  const newHours = currentHours - CLASS_SESSION_HOURS

  const { error: updateError } = await supabase
    .from('enrollments')
    .update({ remaining_hours: newHours })
    .eq('id', enrollmentId)

  if (updateError) {
    return { success: false, message: updateError.message }
  }

  const { error: logError } = await supabase.from('attendance_logs').insert([
    {
      enrollment_id: enrollmentId,
      subject_id: subjectId,
    },
  ])

  if (logError) {
    return { success: false, message: logError.message }
  }

  revalidatePath('/dashboard')
  return { success: true, remaining: newHours }
}
