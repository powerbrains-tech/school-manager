'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import { useParams } from 'next/navigation'

export default function StudentProfile() {
  const params = useParams()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [student, setStudent] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStudent() {
      // ดึง id จาก URL (เช่น S001)
      const studentId = params.id

      // ค้นหาข้อมูลนักเรียน + คอร์สที่ลง + ชั่วโมงคงเหลือ
      const { data, error } = await supabase
        .from('students')
        .select(`
          *,
          enrollments (
            remaining_hours,
            courses ( title )
          )
        `)
        .eq('student_id', studentId) // ค้นหาจาก column student_id ใน database
        .single()

      if (error) {
        console.error('Error fetching:', error)
      } else {
        setStudent(data)
      }
      setLoading(false)
    }

    if (params.id) fetchStudent()
  }, [params.id])

  if (loading) return <div className="p-10 text-center">กำลังโหลดข้อมูล...</div>
  
  if (!student) return (
    <div className="p-10 text-center text-red-500">
      ไม่พบข้อมูลนักเรียนรหัส {params.id} <br/>
      <a href="/register" className="text-blue-500 underline">กลับไปหน้าลงทะเบียน</a>
    </div>
  )

  // ดึงข้อมูลคอร์สแรกมาแสดง (สมมติว่าเรียนทีละคอร์ส)
  const currentCourse = student.enrollments?.[0]
  const courseName = currentCourse?.courses?.title || 'ยังไม่มีคอร์ส'
  const hoursLeft = currentCourse?.remaining_hours || 0

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      
      {/* การ์ดบัตรนักเรียน */}
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden border border-gray-200">
        
        {/* ส่วนหัวบัตร */}
        <div className="bg-blue-600 p-6 text-center text-white">
          <h1 className="text-2xl font-bold">{student.name}</h1>
          <p className="opacity-80 mt-1">ID: {student.student_id}</p>
        </div>

        {/* ส่วน QR Code */}
        <div className="p-8 flex flex-col items-center justify-center bg-white">
          <div className="p-2 border-4 border-blue-100 rounded-lg">
            {/* สร้าง QR Code จาก student_id */}
            <QRCodeSVG value={student.student_id} size={200} />
          </div>
          <p className="mt-4 text-gray-500 text-sm">สแกน QR Code นี้เพื่อเข้าเรียน</p>
        </div>

        {/* ส่วนแสดงสถานะเครดิต */}
        <div className="bg-gray-50 p-6 border-t border-gray-100">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600 text-sm">คอร์สปัจจุบัน</span>
            <span className="text-blue-800 font-semibold text-sm text-right">{courseName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 text-sm">ชั่วโมงคงเหลือ</span>
            <span className="text-3xl font-bold text-green-600">{hoursLeft} <span className="text-sm text-gray-400 font-normal">ชม.</span></span>
          </div>
        </div>

      </div>

      <div className="mt-8 text-sm text-gray-400">
        ระบบจัดการโรงเรียน By ครูพี่...
      </div>
    </div>
  )
}