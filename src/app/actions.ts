'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function logout() {
  // 1. ลบ Cookie ที่ชื่อ admin_session ทิ้ง
  const cookieStore = await cookies()
  cookieStore.delete('admin_session')
  
  // 2. ดีดกลับไปหน้า Login
  redirect('/login')
}