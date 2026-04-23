'use server'

import { supabase } from '../lib/supabase'
import { revalidatePath } from 'next/cache'

export async function addCourse(formData: FormData) {
  const title = formData.get('title') as string
  const total_hours = parseInt(formData.get('total_hours') as string) || 0

  if (!title) return { success: false, error: 'กรุณากรอกชื่อคอร์สเรียน' }

  try {
    const { error } = await supabase
      .from('courses')
      .insert([{ title, total_hours }])

    if (error) throw error

    revalidatePath('/courses')
    revalidatePath('/register')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function deleteCourse(id: string) {
  if (!id) return { success: false, error: 'ไม่พบรหัสคอร์ส' }
  
  try {
    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (error) throw error

    revalidatePath('/courses')
    revalidatePath('/register')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: 'ไม่สามารถลบได้ (อาจมีนักเรียนลงทะเบียนคอร์สนี้อยู่)' }
  }
}

export async function updateCourse(formData: FormData) {
  const id = formData.get('id') as string
  const title = formData.get('title') as string
  const total_hours = parseInt(formData.get('total_hours') as string) || 0

  if (!id || !title) return { success: false, error: 'ข้อมูลไม่ครบถ้วน' }

  try {
    const { error } = await supabase
      .from('courses')
      .update({ title, total_hours })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/courses')
    revalidatePath('/register')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}