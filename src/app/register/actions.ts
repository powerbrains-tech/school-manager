// src/app/actions.ts
'use server'

import { supabase } from '../lib/supabase'

export async function registerStudent(formData: FormData) {
  const name = formData.get('name') as string
  const studentId = formData.get('studentId') as string
  const courseTitle = formData.get('courseTitle') as string
  const hours = parseInt(formData.get('hours') as string)

  // 1. เพิ่มข้อมูลนักเรียน
  const { data: student, error: sError } = await supabase
    .from('students')
    .insert([{ name, student_id: studentId }])
    .select()
    .single()

  if (sError) return { success: false, error: sError.message }

  // 2. สร้างคอร์ส (หรือหาคอร์สเดิม)
  const { data: course, error: cError } = await supabase
    .from('courses')
    .insert([{ title: courseTitle, total_hours: hours }])
    .select()
    .single()

  if (cError) return { success: false, error: cError.message }

  // 3. ผูกนักเรียนเข้ากับคอร์สและตั้งค่าชั่วโมงเริ่มต้น
  const { error: eError } = await supabase
    .from('enrollments')
    .insert([{ 
      student_id: student.id, 
      course_id: course.id, 
      remaining_hours: hours 
    }])

  if (eError) return { success: false, error: eError.message }

  return { success: true }
}
export async function recordAttendance(studentId: string) {
  // 1. ค้นหาข้อมูลนักเรียนและการลงทะเบียนที่ยังมีชั่วโมงเหลือ
  const { data: student, error: sError } = await supabase
    .from('students')
    .select(`
      id, 
      name,
      enrollments!inner (
        id, 
        remaining_hours, 
        course_id,
        courses (title)
      )
    `)
    .eq('student_id', studentId)
    .gt('enrollments.remaining_hours', 0) // ต้องมีชั่วโมงเหลือมากกว่า 0
    .single()

  if (sError || !student) {
    return { success: false, message: 'ไม่พบข้อมูล หรือชั่วโมงเรียนหมดแล้ว' }
  }

  // สมมติว่าตัดทีละ 1 คอร์ส (เอาคอร์สแรกที่เจอ)
  const enrollment = student.enrollments[0]
  
  // 2. ทำการตัดชั่วโมง (ลดลง 1 ชม.)
  const { error: updateError } = await supabase
    .from('enrollments')
    .update({ remaining_hours: enrollment.remaining_hours - 1 })
    .eq('id', enrollment.id)

  if (updateError) return { success: false, message: 'เกิดข้อผิดพลาดในการตัดชั่วโมง' }

  // 3. บันทึก Log การเข้าเรียน
  await supabase
    .from('attendance_logs')
    .insert([{ enrollment_id: enrollment.id }])

  return { 
    success: true, 
    studentName: student.name,
    courseTitle: (enrollment.courses as any)?.title,
    remaining: enrollment.remaining_hours - 1
  }
}