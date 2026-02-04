// src/app/admin/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addHours } from './actions' // Import action ที่เพิ่งสร้าง

export default function AdminDashboard() {
  const [students, setStudents] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  // ฟังก์ชันดึงข้อมูล (เหมือนเดิม)
  async function fetchData() {
    const { data: studentData } = await supabase
      .from('students')
      .select(`*, enrollments (id, remaining_hours, courses (title))`)
      .order('created_at', { ascending: false })

    const { data: logData } = await supabase
      .from('attendance_logs')
      .select(`created_at, enrollments (students (name), courses (title))`)
      .order('created_at', { ascending: false })
      .limit(10)

    if (studentData) setStudents(studentData)
    if (logData) setLogs(logData)
    setLoading(false)
  }

  if (loading) return <div className="p-8 text-center">กำลังโหลดข้อมูล...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">📊 แดชบอร์ดผู้บริหาร</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* ตารางรายชื่อนักเรียน (พื้นที่ใหญ่ 2 ส่วน) */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-xl font-bold mb-4 text-blue-800">👥 จัดการนักเรียน</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-sm">
                    <th className="p-3">ชื่อ</th>
                    <th className="p-3 text-center">คงเหลือ</th>
                    <th className="p-3 text-right">เติมเวลา</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.map((s) => {
                    const course = s.enrollments[0]
                    const hours = course?.remaining_hours || 0
                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="p-3">
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-gray-400">{course?.courses?.title}</div>
                        </td>
                        <td className={`p-3 text-center font-bold ${hours < 5 ? 'text-red-500' : 'text-green-600'}`}>
                          {hours}
                        </td>
                        <td className="p-3 text-right">
                          {/* ฟอร์มเติมชั่วโมง */}
                          <form action={async (formData) => {
                              await addHours(formData)
                              fetchData() // โหลดข้อมูลใหม่หลังเติมเสร็จ
                              alert(`เติมเวลาให้ ${s.name} เรียบร้อย!`)
                          }} className="flex justify-end gap-2">
                            <input type="hidden" name="enrollmentId" value={course?.id} />
                            <input 
                              type="number" 
                              name="hours" 
                              placeholder="+ชม." 
                              className="w-16 border rounded px-2 py-1 text-sm text-center"
                              required
                            />
                            <button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                              เติม
                            </button>
                          </form>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ประวัติการเข้าเรียน (พื้นที่เล็ก 1 ส่วน) */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 h-fit">
            <h2 className="text-xl font-bold mb-4 text-orange-600">🕒 ล่าสุด</h2>
            <div className="space-y-3">
              {logs.map((log, i) => (
                <div key={i} className="text-sm border-b border-gray-50 pb-2">
                  <div className="font-bold text-gray-700">{(log.enrollments as any)?.students?.name}</div>
                  <div className="flex justify-between text-gray-500 text-xs mt-1">
                    <span>{(log.enrollments as any)?.courses?.title}</span>
                    <span>{new Date(log.created_at).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}