'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isUserRole, type UserRole } from '../lib/rbac'

const ROLE_PASSWORD_ENV: Record<UserRole, string | undefined> = {
  admin: process.env.ADMIN_PASSWORD,
  teacher: process.env.TEACHER_PASSWORD,
  staff: process.env.STAFF_PASSWORD,
}

const ROLE_NAMES: Record<UserRole, string> = {
  admin: 'ผู้ดูแลระบบสูงสุด',
  teacher: 'คุณครูประจำวิชา',
  staff: 'เจ้าหน้าที่ธุรการ',
}

// ✅ จุดที่แก้ไข: เพิ่ม "prevState: any" เข้ามาเป็นตัวแรกครับ
export async function login(prevState: any, formData: FormData) {
  
  const roleValue = formData.get('role') as string
  const password = formData.get('password') as string

  if (!isUserRole(roleValue)) {
    return { success: false, message: 'กรุณาเลือกระดับผู้ใช้งาน' }
  }

  if (!password) {
    return { success: false, message: 'กรุณากรอกรหัสผ่าน' }
  }

  const expectedPassword = ROLE_PASSWORD_ENV[roleValue]
  if (!expectedPassword) {
    return { success: false, message: `ระบบยังไม่ได้ตั้งค่ารหัสผ่านสำหรับ ${roleValue.toUpperCase()}` }
  }

  if (password !== expectedPassword) {
    return { success: false, message: '❌ รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่' }
  }

  const userData = {
    id: roleValue,
    name: ROLE_NAMES[roleValue],
    role: roleValue,
    isLoggedIn: true
  }

  const cookieStore = await cookies()
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24, // 1 วัน
    path: '/',
  }

  cookieStore.set('admin_session', JSON.stringify(userData), cookieOptions)

  redirect('/dashboard')
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('admin_session')
  redirect('/login')
}