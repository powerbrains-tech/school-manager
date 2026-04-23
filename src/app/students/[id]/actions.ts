'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission } from '../../lib/auth' 
import { supabase } from '../../lib/supabase'

// --- Helper: แกะ Path จาก URL รูปภาพเพื่อใช้ลบไฟล์ ---
function extractAvatarPath(imageUrl: string | null) {
  if (!imageUrl) return null
  try {
    const url = new URL(imageUrl)
    const marker = '/storage/v1/object/public/avatars/'
    const markerIndex = url.pathname.indexOf(marker)

    if (markerIndex === -1) return null
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length))
  } catch {
    return null
  }
}

// ---------------------------------------------------------
// 1. อัปเดตข้อมูลนักเรียน (ชื่อ, รร., ระดับชั้น, คอร์ส, สถานะ, ข้อความ, ข้อมูลส่วนตัว/ผู้ปกครอง)
// ---------------------------------------------------------
export async function updateStudentInfo(formData: FormData) {
  // 1. ตรวจสอบสิทธิ์
  const access = await requirePermission('edit')
  if (!access.ok) return { success: false, error: access.error }

  // 2. ดึงข้อมูลจาก Form
  const studentId = formData.get('studentId') as string
  if (!studentId) return { success: false, error: 'ไม่พบรหัสนักเรียน' }

  const name = formData.get('name') as string
  const nickname = formData.get('nickname') as string
  const phone = formData.get('phone') as string
  const level = formData.get('level') as string          
  const schoolName = formData.get('school_name') as string 
  
  const student_status = formData.get('student_status') as string
  const teacher_message = formData.get('teacher_message') as string

  // ✅ เพิ่มตัวแปรดึงข้อมูลส่วนตัว & ผู้ปกครอง
  const prefix = formData.get('prefix') as string || null
  const dob = formData.get('dob') as string || null
  const religion = formData.get('religion') as string || null
  const parent_name = formData.get('parent_name') as string || null
  const parent_phone = formData.get('parent_phone') as string || null
  const parent_line_id = formData.get('parent_line_id') as string || null

  // 3. อัปเดตตาราง students
  const { error: studentError } = await supabase
    .from('students')
    .update({ 
      name, 
      nickname, 
      phone, 
      level,       
      school_name: schoolName, 
      student_status,    
      teacher_message,   
      prefix,           // ✅ บันทึกคำนำหน้า
      dob: dob || null, // ✅ บันทึกวันเกิด (ถ้าว่างให้เป็น null)
      religion,         // ✅ บันทึกศาสนา
      parent_name,      // ✅ บันทึกชื่อผู้ปกครอง
      parent_phone,     // ✅ บันทึกเบอร์ผู้ปกครอง
      parent_line_id    // ✅ บันทึก Line ID
    })
    .eq('student_id', studentId)

  if (studentError) return { success: false, error: studentError.message }

  // 4. วนลูปอัปเดตข้อมูลคอร์สเรียน (Hours & Title)
  const entries = Array.from(formData.entries())

  for (const [key, value] of entries) {
    if (key.startsWith('course-hours-')) {
      const enrollmentId = key.replace('course-hours-', '')
      const hours = Number.parseFloat(value as string)

      if (!Number.isNaN(hours) && hours >= 0) {
        await supabase
          .from('enrollments')
          .update({ remaining_hours: hours })
          .eq('id', enrollmentId)
      }
    }

    if (key.startsWith('course-title-')) {
      const courseId = key.replace('course-title-', '')
      const title = (value as string).trim()

      if (title) {
        await supabase.from('courses').update({ title }).eq('id', courseId)
      }
    }
  }

  // 5. รีเฟรชหน้าเว็บ
  revalidatePath(`/students/${studentId}`)
  revalidatePath('/students')
  return { success: true }
}

// ---------------------------------------------------------
// 2. ลบนักเรียน (และข้อมูลที่เกี่ยวข้องทั้งหมด)
// ---------------------------------------------------------
export async function deleteStudent(studentId: string) {
  const access = await requirePermission('delete')
  if (!access.ok) return { success: false, error: access.error }

  // 1. หาข้อมูลนักเรียนก่อน (เพื่อเอารูปภาพและ ID)
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, image_url')
    .eq('student_id', studentId)
    .maybeSingle()

  if (studentError) return { success: false, error: studentError.message }
  if (!student) return { success: false, error: 'ไม่พบข้อมูลนักเรียน' }

  // 2. ลบข้อมูลที่เกี่ยวข้อง (Manual Cascade)
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id')
    .eq('student_id', student.id)

  const enrollmentIds = (enrollments || []).map((e) => e.id)

  if (enrollmentIds.length > 0) {
    await supabase.from('attendance_logs').delete().in('enrollment_id', enrollmentIds)
    await supabase.from('enrollments').delete().eq('student_id', student.id)
  }

  await supabase.from('daily_checkins').delete().eq('student_id', studentId)

  // 3. ลบตัวนักเรียนออกจากตาราง students
  const { error: deleteError } = await supabase
    .from('students')
    .delete()
    .eq('student_id', studentId)

  if (deleteError) return { success: false, error: deleteError.message }

  // 4. ลบไฟล์รูปภาพออกจาก Storage
  const avatarPath = extractAvatarPath(student.image_url)
  if (avatarPath) {
    await supabase.storage.from('avatars').remove([avatarPath])
  }

  revalidatePath('/students')
  revalidatePath('/dashboard')
  return { success: true }
}

// ---------------------------------------------------------
// 3. อัปเดตและเปลี่ยนรูปโปรไฟล์ (Upload + Cleanup Old)
// ---------------------------------------------------------
export async function updateStudentPhoto(formData: FormData) {
  const access = await requirePermission('edit')
  if (!access.ok) return { success: false, error: access.error }

  const studentId = formData.get('studentId') as string
  const photoFile = formData.get('photo') as File

  if (!photoFile || photoFile.size === 0) {
    return { success: false, error: 'กรุณาเลือกไฟล์รูปภาพ' }
  }

  try {
    const { data: oldStudent } = await supabase
        .from('students')
        .select('image_url')
        .eq('student_id', studentId)
        .single()

    const safeFileName = photoFile.name.replace(/[^a-zA-Z0-9.]/g, '')
    const fileName = `${studentId}-${Date.now()}-${safeFileName}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, photoFile)

    if (uploadError) throw uploadError

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName)
    const newImageUrl = publicUrlData.publicUrl

    const { error: dbError } = await supabase
      .from('students')
      .update({ image_url: newImageUrl })
      .eq('student_id', studentId)

    if (dbError) throw dbError

    if (oldStudent?.image_url) {
        const oldAvatarPath = extractAvatarPath(oldStudent.image_url)
        if (oldAvatarPath && oldAvatarPath !== fileName) {
            await supabase.storage.from('avatars').remove([oldAvatarPath])
        }
    }

    revalidatePath(`/students/${studentId}`)
    revalidatePath('/students')
    return { success: true }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

// ---------------------------------------------------------
// 4. ฟังก์ชันเติมชั่วโมงเรียน (รองรับเลขที่บิล)
// ---------------------------------------------------------
export async function topUpCourse(formData: FormData) {
  const studentDbId = formData.get('studentDbId') as string
  const course_id = formData.get('course_id') as string
  const hours = parseInt(formData.get('hours') as string)
  const bill_number = formData.get('bill_number') as string || null 

  if (!studentDbId || !course_id || !hours) {
    return { success: false, error: 'ข้อมูลไม่ครบถ้วน' }
  }

  try {
    const { data: existing } = await supabase
      .from('enrollments')
      .select('id, remaining_hours')
      .eq('student_id', studentDbId)
      .eq('course_id', course_id)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('enrollments')
        .update({ 
            remaining_hours: existing.remaining_hours + hours,
            bill_number: bill_number 
        })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('enrollments')
        .insert([{ 
            student_id: studentDbId, 
            course_id: course_id, 
            remaining_hours: hours,
            bill_number: bill_number 
        }])
      if (error) throw error
    }

    revalidatePath('/students')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ---------------------------------------------------------
// 5. ฟังก์ชันลบคอร์สที่ลงทะเบียนผิด
// ---------------------------------------------------------
export async function deleteStudentEnrollment(enrollmentId: number) {
  if (!enrollmentId) return { success: false, error: 'ไม่พบรหัสการลงทะเบียน' }

  try {
    await supabase.from('attendance_logs').delete().eq('enrollment_id', enrollmentId)

    const { error } = await supabase.from('enrollments').delete().eq('id', enrollmentId)
    if (error) throw error

    revalidatePath('/students')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}