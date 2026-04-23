'use server'

import { supabase } from '../lib/supabase'
import { revalidatePath } from 'next/cache'

// 1. เพิ่มคุณครูคนใหม่
export async function addTeacher(formData: FormData) {
  const name = formData.get('name') as string
  const nickname = formData.get('nickname') as string

  if (!name) return { success: false, error: 'กรุณากรอกชื่อ-นามสกุล' }

  try {
    const { error } = await supabase
      .from('teachers')
      .insert([{ name, nickname }])

    if (error) throw error

    // รีเฟรชหน้าครู และหน้าตารางสอน (เพื่อให้ตัวเลือกใน Pop-up อัปเดตด้วย)
    revalidatePath('/teachers')
    revalidatePath('/timetable')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 2. ลบข้อมูลคุณครู
export async function deleteTeacher(id: string) {
  try {
    const { error } = await supabase
      .from('teachers')
      .delete()
      .eq('id', id)

    if (error) throw error

    revalidatePath('/teachers')
    revalidatePath('/timetable')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: 'ไม่สามารถลบได้ (อาจมีตารางสอนผูกอยู่กับครูท่านนี้)' }
  }
}
// 3. แก้ไขข้อมูลคุณครู
export async function updateTeacher(formData: FormData) {
  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const nickname = formData.get('nickname') as string

  if (!id || !name) return { success: false, error: 'ข้อมูลไม่ครบถ้วน' }

  try {
    const { error } = await supabase
      .from('teachers')
      .update({ name, nickname })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/teachers')
    revalidatePath('/timetable')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}