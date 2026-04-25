'use server'

import { supabase } from '../lib/supabase'
import { revalidatePath } from 'next/cache'

// ==========================================
// 🔧 Helper: ฟังก์ชันสั่งรีเฟรชหน้าเว็บที่เกี่ยวข้อง
// ==========================================
function revalidateCoursePaths() {
  revalidatePath('/courses')
  revalidatePath('/register')
  revalidatePath('/dashboard') // ✅ เพิ่มให้ยอดสรุปหน้า Dashboard อัปเดตทันที
}

// ==========================================
// 1. ฟังก์ชันเพิ่มคอร์สใหม่
// ==========================================
export async function addCourse(formData: FormData) {
  const title = formData.get('title') as string
  const type = formData.get('type') as string || 'hourly' 
  
  const total_hours = type === 'hourly' ? parseInt(formData.get('total_hours') as string) || 0 : null
  const duration_months = type === 'monthly' ? parseInt(formData.get('duration_months') as string) || 1 : null

  // ✅ ใช้ .trim() ป้องกันการเคาะสเปซบาร์เปล่าๆ
  if (!title || title.trim() === '') {
    return { success: false, error: 'กรุณากรอกชื่อคอร์สเรียน' }
  }

  try {
    const { error } = await supabase
      .from('courses')
      .insert([{ 
        title: title.trim(), 
        type, 
        total_hours, 
        duration_months 
      }])

    if (error) throw error

    revalidateCoursePaths() // ✅ เรียกใช้ฟังก์ชันรีเฟรช
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

    revalidateCoursePaths() // ✅ เรียกใช้ฟังก์ชันรีเฟรช
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

  const total_hours = type === 'hourly' ? parseInt(formData.get('total_hours') as string) || 0 : null
  const duration_months = type === 'monthly' ? parseInt(formData.get('duration_months') as string) || 1 : null

  if (!id || !title || title.trim() === '') {
    return { success: false, error: 'ข้อมูลไม่ครบถ้วน' }
  }

  try {
    const { error } = await supabase
      .from('courses')
      .update({ 
        title: title.trim(), 
        type, 
        total_hours, 
        duration_months 
      })
      .eq('id', id)

    if (error) throw error

    revalidateCoursePaths() // ✅ เรียกใช้ฟังก์ชันรีเฟรช
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}