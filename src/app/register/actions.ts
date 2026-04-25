'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission } from '../lib/auth' 
import { CLASS_SESSION_HOURS } from '../lib/constants'
import { supabase } from '../lib/supabase'

export async function registerStudent(formData: FormData) {
  const access = await requirePermission('edit') 
  if (!access.ok) return { success: false, error: access.error }

  let studentId = '' 
  const course_id = formData.get('course_id') as string
  const hours = Number.parseFloat((formData.get('hours') as string) || '0')
  const photoFile = formData.get('photo') as File

  const start_date = (formData.get('start_date') as string) || new Date().toISOString().split('T')[0]

  const prefix = formData.get('prefix') as string || null
  const name = (formData.get('name') as string) || ''
  const nickname = formData.get('nickname') as string || null
  const phone = formData.get('phone') as string || null
  const dob = formData.get('dob') as string || null
  const religion = formData.get('religion') as string || null
  const level = formData.get('level') as string || null
  const schoolName = formData.get('school_name') as string || null
  
  const parent_name = formData.get('parent_name') as string || null
  const parent_phone = formData.get('parent_phone') as string || null
  const parent_line_id = formData.get('parent_line_id') as string || null

  const enrolled_subjects = formData.get('enrolled_subjects') as string || null
  
  // ✅ รับค่าวันเรียนปกติจากหน้าฟอร์ม
  const study_days = formData.get('study_days') as string || null

  // 1. ระบบ Auto-Generate รหัสนักเรียน
  const { data: latest } = await supabase
    .from('students')
    .select('student_id')
    .ilike('student_id', 'S%') 
    .order('student_id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latest && latest.student_id) {
    const numMatch = latest.student_id.match(/\d+/)
    const currentNum = numMatch ? parseInt(numMatch[0], 10) : 0
    studentId = `S${(currentNum + 1).toString().padStart(4, '0')}`
  } else {
    studentId = 'S0001' 
  }

  if (!name || !studentId || !course_id || !Number.isFinite(hours) || hours < 0) {
    return { success: false, error: 'กรุณากรอกข้อมูลสำคัญให้ครบถ้วน (ตรวจสอบชั่วโมงหรือชื่อนักเรียน)' }
  }

  // 3. จัดการอัปโหลดรูปภาพ
  let imageUrl: string | null = null
  if (photoFile && photoFile.size > 0) {
    try {
      const safeFileName = photoFile.name.replace(/[^a-zA-Z0-9.]/g, '')
      const fileName = `${studentId}-${Date.now()}-${safeFileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, photoFile)

      if (!uploadError) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
        imageUrl = data.publicUrl
      }
    } catch (error) {
      console.error('Upload exception:', error)
    }
  }

  const studentDataToSave = {
    name,
    nickname,
    phone,
    level,
    school_name: schoolName,
    prefix,
    dob,
    religion,
    parent_name,
    parent_phone,
    parent_line_id,
  }

  let studentDbId: string | null = null

  // 4. บันทึกข้อมูลนักเรียน (Insert หรือ Update)
  const { data: existingStudent } = await supabase
    .from('students')
    .select('id, image_url')
    .eq('student_id', studentId)
    .maybeSingle()

  if (existingStudent) {
    studentDbId = existingStudent.id
    const finalImageUrl = imageUrl || existingStudent.image_url

    const { error: updateError } = await supabase
      .from('students')
      .update({
        ...studentDataToSave,
        image_url: finalImageUrl,
      })
      .eq('id', studentDbId)

    if (updateError) return { success: false, error: updateError.message }
  } else {
    const { data: newStudent, error: insertError } = await supabase
      .from('students')
      .insert([
        {
          student_id: studentId,
          ...studentDataToSave,
          image_url: imageUrl,
        },
      ])
      .select('id')
      .single()

    if (insertError) return { success: false, error: insertError.message }
    studentDbId = newStudent.id
  }

  // 5. ดึงข้อมูลคอร์สเพื่อมาคำนวณวันหมดอายุ (ถ้าเป็นคอร์สรายเดือน)
  const { data: courseData } = await supabase
    .from('courses')
    .select('type, duration_months')
    .eq('id', course_id)
    .single()

  let expiry_date: string | null = null
  let final_hours = hours

  if (courseData?.type === 'monthly') {
    final_hours = 0; 
    const startDateObj = new Date(start_date)
    startDateObj.setMonth(startDateObj.getMonth() + (courseData.duration_months || 1))
    expiry_date = startDateObj.toISOString().split('T')[0] 
  }

  // 6. บันทึกข้อมูลการลงทะเบียน (เพิ่ม study_days)
  const { error: enrollmentError } = await supabase.from('enrollments').insert([
    {
      student_id: studentDbId,
      course_id: course_id,
      remaining_hours: final_hours,
      enrolled_subjects: enrolled_subjects,
      start_date: start_date,     
      expiry_date: expiry_date,    
      study_days: study_days // ✅ บันทึกวันที่มาเรียนปกติ
    },
  ])

  if (enrollmentError) return { success: false, error: enrollmentError.message }

  revalidatePath('/students')
  revalidatePath('/courses')
  revalidatePath('/dashboard')
  
  return { success: true, studentId: studentId }
}

// ==============================================
// ⚠️ หมายเหตุ: ฟังก์ชัน recordAttendance นี้เป็นของเดิม
// ในอนาคตเราจะต้องมาอัปเกรดให้รองรับการสแกนคอร์สรายเดือนด้วยครับ
// ==============================================
export async function recordAttendance(studentId: string) {
  const access = await requirePermission('edit')
  if (!access.ok) return { success: false, message: access.error }

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select(`
      id, name, nickname,
      enrollments!inner (
        id, remaining_hours, course_id,
        courses (title)
      )
    `)
    .eq('student_id', studentId)
    .gte('enrollments.remaining_hours', CLASS_SESSION_HOURS)
    .maybeSingle()

  if (studentError || !student) {
    return { success: false, message: 'ไม่พบข้อมูลนักเรียน หรือชั่วโมงเรียนไม่พอ' }
  }

  const enrollment = student.enrollments[0]
  const remainingHours = enrollment.remaining_hours - CLASS_SESSION_HOURS

  const { error: updateError } = await supabase
    .from('enrollments')
    .update({ remaining_hours: remainingHours })
    .eq('id', enrollment.id)

  if (updateError) return { success: false, message: 'ตัดชั่วโมงไม่สำเร็จ' }

  await supabase.from('attendance_logs').insert([{ enrollment_id: enrollment.id }])

  revalidatePath('/students')
  revalidatePath(`/students/${studentId}`)
  revalidatePath('/dashboard') 

  const course = enrollment.courses as { title?: string } | null

  return {
    success: true,
    studentName: student.nickname ? `${student.name} (${student.nickname})` : student.name,
    courseTitle: course?.title,
    remaining: remainingHours,
  }
}