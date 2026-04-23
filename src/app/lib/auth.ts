import { cookies } from 'next/headers'
import { UserRole, hasPermission, Permission } from './rbac'

// ฟังก์ชันดึงข้อมูล Session (แกะ JSON)
export async function getSession() {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')

  if (!session) return null

  try {
    // ✅ แกะข้อมูล JSON ที่เราบันทึกไว้ตอน Login
    return JSON.parse(session.value)
  } catch (error) {
    // กันเหนียว กรณี Cookie เสียหรือเป็นแบบเก่า
    return null
  }
}

// ฟังก์ชันดึง Role ของคนปัจจุบัน
export async function getUserRole(): Promise<UserRole | null> {
  const session = await getSession()
  if (!session || !session.role) return null
  return session.role as UserRole
}

// ฟังก์ชันหลักที่ใช้ตรวจสอบสิทธิ์ (ที่หน้า Register เรียกใช้)
export async function requirePermission(permission: Permission) {
  const role = await getUserRole()

  // 1. ถ้าหา Role ไม่เจอ = ยังไม่ล็อกอิน หรือ Cookie หมดอายุ
  if (!role) {
    return { ok: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }
  }

  // 2. ถ้ามี Role แต่สิทธิ์ไม่ถึง (เช็คจาก rbac.ts)
  if (!hasPermission(role, permission)) {
    return { ok: false, error: 'คุณไม่มีสิทธิ์ใช้งานฟังก์ชันนี้' }
  }

  // 3. ผ่านฉลุย ✅
  return { ok: true }
}