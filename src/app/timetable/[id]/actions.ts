'use server'

import { supabase } from '../../lib/supabase'
import { revalidatePath } from 'next/cache'

export async function processCheckIn(
  classStudentId: string, 
  enrollmentId: string | number, // ✅ แก้ให้รองรับทั้งตัวเลขและ UUID
  hoursToDeduct: number, 
  scheduleId: string,
  subjectId?: number | null
) {
  try {
    // 1. เช็คชั่วโมงคงเหลือของคอร์สนี้
    const { data: enroll } = await supabase
      .from('enrollments')
      .select('remaining_hours')
      .eq('id', enrollmentId)
      .single()

    // ✅ แยก Error ให้ชัดเจน จะได้รู้ว่าพังที่หาคอร์สไม่เจอ หรือชั่วโมงไม่พอ
    if (!enroll) {
      return { success: false, error: 'หาคอร์สเรียนไม่เจอในระบบ (ข้อมูล ID อาจคลาดเคลื่อน)' }
    }

    if (enroll.remaining_hours < hoursToDeduct) {
      return { success: false, error: `ชั่วโมงไม่พอ (เหลือแค่ ${enroll.remaining_hours} ชม.)` }
    }

    // 2. หักชั่วโมงเรียน
    const newHours = enroll.remaining_hours - hoursToDeduct
    const { error: updateEnrollError } = await supabase
      .from('enrollments')
      .update({ remaining_hours: newHours })
      .eq('id', enrollmentId)
      
    if (updateEnrollError) throw updateEnrollError

    // 3. อัปเดตสถานะในห้องเรียนว่า "มาเรียนแล้ว"
    const { error: checkInError } = await supabase
      .from('class_students')
      .update({ attendance_status: 'present' })
      .eq('id', classStudentId)

    if (checkInError) throw checkInError

    // 4. บันทึกประวัติการเข้าเรียน
    const logData: any = { enrollment_id: enrollmentId }
    if (subjectId) logData.subject_id = subjectId

    const { error: logError } = await supabase
      .from('attendance_logs')
      .insert([logData])

    if (logError) throw logError

    // 5. สั่งรีเฟรชหน้าเว็บ
    revalidatePath(`/timetable/${scheduleId}`)
    return { success: true }
    
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}