// src/app/admin/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase' // ตรวจสอบ path ให้ถูกนะครับ (อาจจะเป็น ../../lib/supabase)

export default function AdminDashboard() {
  const [students, setStudents] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    // 1. ดึงข้อมูลนักเรียนและชั่วโมงคงเหลือ
    const { data: studentData } = await supabase
      .from('students')
      .select(`
        *,
        enrollments (
          remaining_hours,
          courses (title)
        )
      `)
      .order('created_at', { ascending: false })

    // 2. ดึงประวัติการเข้าเรียนล่าสุด 10 รายการ
    const { data: logData } = await supabase
      .from('attendance_logs')
      .select(`
        created_at,
        enrollments (
          students (name, student_id),
          courses (title)
        )
      `)
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* ตารางรายชื่อนักเรียน */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-xl font-bold mb-4 text-blue-800 flex items-center gap-2">
              👥 นักเรียนทั้งหมด ({students.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-sm">
                    <th className="p-3">ชื่อ</th>
                    <th className="p-3">คอร์ส</th>
                    <th className="p-3 text-right">คงเหลือ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.map((s) => {
                    const course = s.enrollments[0]
                    const hours = course?.remaining_hours || 0
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 transition">
                        <td className="p-3">
                          <div className="font-medium text-gray-900">{s.name}</div>
                          <div className="text-xs text-gray-400">{s.student_id}</div>
                        </td>
                        <td className="p-3 text-sm text-gray-600 truncate max-w-[150px]">
                          {course?.courses?.title || '-'}
                        </td>
                        <td className={`p-3 text-right font-bold ${hours < 5 ? 'text-red-500' : 'text-green-600'}`}>
                          {hours} ชม.
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ประวัติการเข้าเรียนล่าสุด */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-xl font-bold mb-4 text-orange-600 flex items-center gap-2">
              🕒 เข้าเรียนล่าสุด
            </h2>
            <div className="space-y-4">
              {logs.map((log, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100">
                  <div>
                    <p className="font-bold text-gray-800">
                      {(log.enrollments as any)?.students?.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(log.enrollments as any)?.courses?.title}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-orange-800">
                      {new Date(log.created_at).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(log.created_at).toLocaleDateString('th-TH')}
                    </p>
                  </div>
                </div>
              ))}
              {logs.length === 0 && <p className="text-gray-400 text-center py-4">ยังไม่มีประวัติการเรียน</p>}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}