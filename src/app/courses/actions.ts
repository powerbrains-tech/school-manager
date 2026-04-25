'use server'

import { supabase } from '../lib/supabase'
import { revalidatePath } from 'next/cache'

// ==========================================
// 1. ฟังก์ชันเพิ่มคอร์สใหม่
// ==========================================
export async function addCourse(formData: FormData) {
  const title = formData.get('title') as string
  const type = formData.get('type') as string || 'hourly' // ดึงประเภทคอร์ส (ค่าเริ่มต้นคือรายชั่วโมง)
  
  // เช็คเงื่อนไข: ถ้าเป็นรายชั่วโมงเก็บชั่วโมง / ถ้าเป็นรายเดือนเก็บจำนวนเดือน
  const total_hours = type === 'hourly' ? parseInt(formData.get('total_hours') as string) || 0 : null
  const duration_months = type === 'monthly' ? parseInt(formData.get('duration_months') as string) || 1 : null

  if (!title) return { success: false, error: 'กรุณากรอกชื่อคอร์สเรียน' }

  try {
    const { error } = await supabase
      .from('courses')
      .insert([{ 
        title, 
        type, 
        total_hours, 
        duration_months 
      }])

    if (error) throw error

    // รีเฟรชหน้าเว็บเพื่อให้ข้อมูลอัปเดตทันที
    revalidatePath('/courses')
    revalidatePath('/register')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ==========================================
// 2. ฟังก์ชันลบคอร์ส
// ==========================================
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

// ==========================================
// 3. ฟังก์ชันแก้ไขคอร์ส
// ==========================================
export async function updateCourse(formData: FormData) {
  const id = formData.get('id') as string
  const title = formData.get('title') as string
  const type = formData.get('type') as string || 'hourly'

  // เช็คเงื่อนไขเหมือนตอนสร้างใหม่เป๊ะๆ
  const total_hours = type === 'hourly' ? parseInt(formData.get('total_hours') as string) || 0 : null
  const duration_months = type === 'monthly' ? parseInt(formData.get('duration_months') as string) || 1 : null

  if (!id || !title) return { success: false, error: 'ข้อมูลไม่ครบถ้วน' }

  try {
    const { error } = await supabase
      .from('courses')
      .update({ 
        title, 
        type, 
        total_hours, 
        duration_months 
      })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/courses')
    revalidatePath('/register')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}