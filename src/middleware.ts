import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // 1. ดึง Cookie ออกมาดู
  const session = request.cookies.get('admin_session')
  const { pathname } = request.nextUrl

  // 2. กำหนดพื้นที่หวงห้าม (Protected Routes)
  const protectedRoutes = ['/dashboard', '/students', '/scan', '/class-scan', '/register']
  
  // เช็คว่ากำลังจะเข้าพื้นที่หวงห้ามหรือเปล่า?
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  // 🔴 กรณีที่ 1: จะเข้าพื้นที่หวงห้าม แต่ "ไม่มีบัตร" (Session) -> ดีดไป Login
  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 🟢 กรณีที่ 2: จะเข้าหน้า Login แต่ "มีบัตรแล้ว" -> ดีดไป Dashboard เลย (ไม่ต้องล็อกอินซ้ำ)
  if (pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

// กำหนดว่าจะให้ Middleware ทำงานที่หน้าไหนบ้าง
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/students/:path*', 
    '/scan/:path*',
    '/class-scan/:path*',
    '/register/:path*',
    '/login'
  ],
}