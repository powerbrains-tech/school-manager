'use server'

import { supabase } from '../lib/supabase'
import { revalidatePath } from 'next/cache'

// 🔍 ดึงรายชื่อวิชาทั้งหมดเพื่อเอาไปใส่ใน Dropdown
export async function getSubjects() {
  const { data, error } = await supabase.from('subjects').select('id, name').order('name')
  if (error) {
    console.error('Error fetching subjects:', error)
    return []
  }
  return data
}

// 🔍 ฟังก์ชันค้นหานักเรียนจาก ชื่อ, ชื่อเล่น หรือ รหัส
export async function searchActiveStudents(query: string) {
  if (!query) return []
  
  const { data, error } = await supabase
    .from('students')
    .select(`
      id, student_id, name, nickname, image_url,
      enrollments (
        id, remaining_hours,
        courses (title)
      )
    `)
    .or(`name.ilike.%${query}%,nickname.ilike.%${query}%,student_id.ilike.%${query}%`)
    .limit(10)

  if (error) {
    console.error('Search error:', error)
    return []
  }
  return data
}

// ✂️ ฟังก์ชันหักชั่วโมงเรียนและบันทึกประวัติ (รองรับการเก็บวิชาที่เรียน)
export async function deductCourseHours(enrollmentId: number, hoursToDeduct: number, subjectId?: string | null) {
  try {
    const { data: enroll } = await supabase
      .from('enrollments')
      .select('remaining_hours')
      .eq('id', enrollmentId)
      .single()

    if (!enroll) return { success: false, error: 'ไม่พบข้อมูลคอร์ส' }
    if (enroll.remaining_hours < hoursToDeduct) return { success: false, error: 'ชั่วโมงเรียนไม่พอตัด' }

    const newHours = enroll.remaining_hours - hoursToDeduct

    const { error: updateError } = await supabase
      .from('enrollments')
      .update({ remaining_hours: newHours })
      .eq('id', enrollmentId)
      
    if (updateError) throw updateError

    // เตรียมข้อมูลบันทึกประวัติ ถ้ามีการเลือกวิชาให้ใส่ลงไปด้วย
    const logData: any = { enrollment_id: enrollmentId }
    if (subjectId) {
      logData.subject_id = parseInt(subjectId)
    }

    const { error: logError } = await supabase
      .from('attendance_logs')
      .insert([logData])

    if (logError) throw logError

    revalidatePath('/checkin')
    revalidatePath('/students')
    return { success: true, remaining: newHours }
    
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}