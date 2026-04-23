'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission } from '../lib/auth' 
import { CLASS_SESSION_HOURS } from '../lib/constants'
import { supabase } from '../lib/supabase'

export async function registerStudent(formData: FormData) {
  const access = await requirePermission('edit') 
  if (!access.ok) return { success: false, error: access.error }

  // ❌ เราไม่ต้องรับ studentId จาก Form แล้ว ให้ระบบสร้างให้แทน
  let studentId = '' 
  const course_id = formData.get('course_id') as string
  const hours = Number.parseFloat((formData.get('hours') as string) || '0')
  const photoFile = formData.get('photo') as File

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

  // ✅ 1. ระบบ Auto-Generate รหัสนักเรียน
  const { data: latest } = await supabase
    .from('students')
    .select('student_id')
    .ilike('student_id', 'S%') // หาเฉพาะที่ขึ้นต้นด้วย S
    .order('student_id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latest && latest.student_id) {
    // แกะเอาเฉพาะตัวเลข เช่น 'S0015' -> '0015' -> 15
    const numMatch = latest.student_id.match(/\d+/)
    const currentNum = numMatch ? parseInt(numMatch[0], 10) : 0
    // +1 แล้วเติมเลข 0 ข้างหน้าให้ครบ 4 หลัก (S0016)
    studentId = `S${(currentNum + 1).toString().padStart(4, '0')}`
  } else {
    // ถ้ายังไม่มีเด็กในระบบเลย เริ่มต้นที่ S0001
    studentId = 'S0001' 
  }

  // 2. Validation
  if (!name || !studentId || !course_id || !Number.isFinite(hours) || hours <= 0) {
    return { success: false, error: 'กรุณากรอกข้อมูลสำคัญให้ครบถ้วน' }
  }

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

  // เช็คเผื่อเหนียว (กันรหัสซ้ำ)
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

  // บันทึกคอร์สเรียน
  const { error: enrollmentError } = await supabase.from('enrollments').insert([
    {
      student_id: studentDbId,
      course_id: course_id,
      remaining_hours: hours,
      enrolled_subjects: enrolled_subjects 
    },
  ])

  if (enrollmentError) return { success: false, error: enrollmentError.message }

  revalidatePath('/students')
  revalidatePath('/courses')
  revalidatePath('/dashboard')
  
  // ✅ 3. ส่งรหัสที่สร้างใหม่กลับไปให้หน้าเว็บ เพื่อไปโชว์ในปุ่มเปิดดู QR Code
  return { success: true, studentId: studentId }
}

// (ฟังก์ชัน recordAttendance คงไว้เหมือนเดิม)
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