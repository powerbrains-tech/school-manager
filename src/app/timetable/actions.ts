'use server'

import { supabase } from '../lib/supabase'
import { revalidatePath } from 'next/cache'

// 1. โหลดข้อมูลมาใส่ Dropdown (เปลี่ยนจากดึง Courses เป็นดึง Subjects)
export async function getScheduleOptions() {
  const { data: rooms } = await supabase.from('rooms').select('id, name, capacity').order('name')
  const { data: teachers } = await supabase.from('teachers').select('id, name, nickname').order('name')
  // ✅ ดึงข้อมูลวิชา แทนคอร์สเรียน
  const { data: subjects } = await supabase.from('subjects').select('id, name').order('name')

  return {
    rooms: rooms || [],
    teachers: teachers || [],
    subjects: subjects || [] // ✅ ส่ง subjects ไปหน้าเว็บ
  }
}

// 2. บันทึกตารางสอนใหม่
export async function createSchedule(formData: FormData) {
  const schedule_date = formData.get('schedule_date') as string
  const start_time = formData.get('start_time') as string
  const end_time = formData.get('end_time') as string
  const subject_id = formData.get('subject_id') as string // ✅ รับค่าเป็น subject_id
  const teacher_id = formData.get('teacher_id') as string
  const room_id = formData.get('room_id') as string

  if (!schedule_date || !start_time || !end_time || !subject_id || !teacher_id || !room_id) {
    return { success: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }
  }

  try {
    const { error } = await supabase.from('class_schedules').insert([{
      schedule_date,
      start_time,
      end_time,
      subject_id: parseInt(subject_id), // ✅ บันทึกลงช่อง subject_id
      teacher_id,
      room_id,
      status: 'scheduled'
    }])

    if (error) throw error

    revalidatePath('/timetable')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}