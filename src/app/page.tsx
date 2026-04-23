import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Home() {
  // 1. เช็คว่ามีคุกกี้ล็อกอินหรือยัง
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')

  // 2. ถ้ามีคุกกี้แล้ว (เคยล็อกอินไว้)
 if (session) {
    redirect('/dashboard') // 👈 แก้ตรงนี้! (จาก /students เป็น /dashboard)
  }
  
  // 3. ถ้ายังไม่มี (หรือหมดอายุ)
  else {
    redirect('/login') // ส่งไปหน้า Login
  }
}