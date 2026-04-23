'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { login } from './actions'

// ปุ่ม Submit ที่มี Loading state
function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button 
      disabled={pending}
      type="submit" 
      className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-indigo-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
    >
      {pending ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
    </button>
  )
}

export default function LoginPage() {
  // เชื่อมกับ Server Action (login)
  const [state, formAction] = useFormState(login, null)

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-gray-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
            🏫
          </div>
          <h1 className="text-2xl font-bold text-gray-800">ระบบจัดการโรงเรียน</h1>
          <p className="text-gray-500">กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ</p>
        </div>

        <form action={formAction} className="space-y-4">
          
          {/* เลือก Role */}
          <div className="grid grid-cols-3 gap-2 p-1 bg-gray-50 rounded-xl border border-gray-200">
            <label className="cursor-pointer">
              <input type="radio" name="role" value="admin" className="peer sr-only" defaultChecked />
              <div className="text-center py-2 rounded-lg text-sm font-bold text-gray-500 peer-checked:bg-white peer-checked:text-indigo-600 peer-checked:shadow-sm transition">
                แอดมิน
              </div>
            </label>
            <label className="cursor-pointer">
              <input type="radio" name="role" value="teacher" className="peer sr-only" />
              <div className="text-center py-2 rounded-lg text-sm font-bold text-gray-500 peer-checked:bg-white peer-checked:text-orange-600 peer-checked:shadow-sm transition">
                คุณครู
              </div>
            </label>
            <label className="cursor-pointer">
              <input type="radio" name="role" value="staff" className="peer sr-only" />
              <div className="text-center py-2 rounded-lg text-sm font-bold text-gray-500 peer-checked:bg-white peer-checked:text-green-600 peer-checked:shadow-sm transition">
                ธุรการ
              </div>
            </label>
          </div>

          {/* ช่องกรอกรหัส */}
          <div>
            <input 
              type="password" 
              name="password" 
              placeholder="รหัสผ่าน" 
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
              required
            />
          </div>

          {/* แสดง Error Message (ถ้ามี) */}
          {state?.message && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center border border-red-100 font-bold">
              {state.message}
            </div>
          )}

          <SubmitButton />
        </form>
      </div>
    </div>
  )
}