// src/app/page.tsx
'use client'

import { registerStudent } from './actions'  // ใช้จุดเดียวพอ เพราะอยู่ระดับเดียวกัน
import { useState } from 'react'

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    const result = await registerStudent(formData)
    setLoading(false)
    
    if (result.success) {
      alert('ลงทะเบียนนักเรียนสำเร็จ!')
    } else {
      alert('เกิดข้อผิดพลาด: ' + result.error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">ลงทะเบียนนักเรียนใหม่</h1>
        
        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">ชื่อ-นามสกุล</label>
            <input name="name" type="text" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black" />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">รหัสนักเรียน (สำหรับ Gen QR)</label>
            <input name="studentId" type="text" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black" />
          </div>

          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700">ชื่อคอร์สที่สมัคร</label>
            <input name="courseTitle" type="text" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">จำนวนชั่วโมงในคอร์ส</label>
            <input name="hours" type="number" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black" />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-md hover:bg-blue-700 transition disabled:bg-gray-400"
          >
            {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลและเปิดคอร์ส'}
          </button>
        </form>
      </div>
    </div>
  )
}