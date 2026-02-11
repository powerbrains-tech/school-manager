import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // 1. เช็คว่าคนนี้กำลังจะเข้าหน้า /admin ใช่ไหม?
  if (request.nextUrl.pathname.startsWith('/admin')) {
    
    // 2. ดึงข้อมูลรหัสผ่านที่ Browser ส่งมา
    const authHeader = request.headers.get('authorization')

    if (authHeader) {
      // รหัสจะถูกเข้ารหัสมา เราต้องแกะออก (Decode Base64)
      const authValue = authHeader.split(' ')[1]
      const [user, pwd] = atob(authValue).split(':')

      // 3. ตรวจสอบรหัสผ่าน (User: admin)
      // รหัสผ่านจะดึงจากตัวแปร ADMIN_PASSWORD ที่เราตั้งไว้
      if (user === 'admin' && pwd === process.env.ADMIN_PASSWORD) {
        return NextResponse.next() // รหัสถูก -> อนุญาตให้ผ่าน
      }
    }

    // 4. ถ้ารหัสผิด หรือยังไม่ได้กรอก -> สั่งให้ Browser เด้งถามรหัส
    return new NextResponse('Authentication Required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Admin Area"',
      },
    })
  }

  return NextResponse.next()
}

// กำหนดว่าให้ "ยาม" คนนี้ เฝ้าเฉพาะหน้า admin
export const config = {
  matcher: '/admin/:path*',
}