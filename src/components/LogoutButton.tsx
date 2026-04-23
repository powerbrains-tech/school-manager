'use client'

import { LogOut } from 'lucide-react'
import { logout } from '@/app/actions' // เรียกใช้ Server Action ที่เราเพิ่งสร้าง

export default function LogoutButton() {
  return (
    <button
      onClick={() => logout()} // เรียกฟังก์ชัน logout เมื่อกดปุ่ม
      className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-full transition-all active:scale-95 border border-red-100 shadow-sm"
    >
      <LogOut size={16} />
      <span>ออกจากระบบ</span>
    </button>
  )
}