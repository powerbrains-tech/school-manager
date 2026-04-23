'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase' // ตรวจสอบ path ให้ถูกนะครับ (อาจจะ ../../lib/supabase)
import { addHours } from './actions'
import Link from 'next/link'

export default function AdminDashboard() {
  const [students, setStudents] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // State สำหรับแจ้งเตือน (Toast)
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null)
  
  // State สำหรับปุ่ม Loading แยกรายคน (ใช้ ID เป็น key)
  const [topUpLoading, setTopUpLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  // ฟังก์ชันช่วยแสดงแจ้งเตือนแล้วหายไปเอง
  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function fetchData() {
    // 1. ดึงข้อมูลนักเรียน
    const { data: studentData } = await supabase
      .from('students')
      .select(`*, enrollments (id, remaining_hours, courses (title))`)
      .order('created_at', { ascending: false })

    // 2. ดึงประวัติเข้าเรียน
    const { data: logData } = await supabase
      .from('attendance_logs')
      .select(`created_at, enrollments (students (name), courses (title))`)
      .order('created_at', { ascending: false })
      .limit(10)

    if (studentData) setStudents(studentData)
    if (logData) setLogs(logData)
    setLoading(false)
  }

  // ฟังก์ชันจัดการการเติมเงิน
  async function handleTopUp(formData: FormData, studentName: string) {
    const enrollmentId = formData.get('enrollmentId') as string
    setTopUpLoading(enrollmentId) // เริ่มหมุนติ้วๆ ที่ปุ่มนี้
    
    try {
      await addHours(formData)
      await fetchData() // ดึงข้อมูลใหม่ทันที
      showToast(`✅ เติมชั่วโมงให้ ${studentName} เรียบร้อย`, 'success')
      
      // ล้างค่าในช่อง input
      const form = document.getElementById(`form-${enrollmentId}`) as HTMLFormElement
      form?.reset()
    } catch {
      showToast('❌ เกิดข้อผิดพลาด กรุณาลองใหม่', 'error')
    } finally {
      setTopUpLoading(null) // หยุดหมุน
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100 p-6 relative">
      
      {/* 1. ปุ่ม Home กลับหน้าหลัก */}
      <Link href="/" className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm text-gray-600 hover:text-purple-600 hover:shadow-md transition-all font-medium text-sm mb-6">
        <span>🏠</span> กลับเมนูหลัก
      </Link>

      {/* Toast Notification (แจ้งเตือนลอยขวาบน) */}
      {toast && (
        <div className={`fixed top-6 right-6 px-6 py-3 rounded-xl shadow-xl text-white font-medium z-50 transition-all transform animate-bounce-short ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-500'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-purple-600 p-3 rounded-2xl text-white text-2xl shadow-lg shadow-purple-200">
            📊
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">แดชบอร์ดผู้บริหาร</h1>
            <p className="text-gray-500 text-sm">จัดการข้อมูลนักเรียนและตรวจสอบการเข้าเรียน</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Main Content: ตารางนักเรียน (พื้นที่ใหญ่) */}
          <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                👥 รายชื่อนักเรียน <span className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full">{students.length} คน</span>
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4 font-semibold">ข้อมูลนักเรียน</th>
                    <th className="p-4 text-center font-semibold">คงเหลือ (ชม.)</th>
                    <th className="p-4 text-right font-semibold">เติมเวลา</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {students.map((s) => {
                    const course = s.enrollments[0]
                    const hours = course?.remaining_hours || 0
                    const isLow = hours < 5
                    const enrollmentId = course?.id

                    return (
                      <tr key={s.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-4">
                          {/* Wrap ด้วย Link เพื่อให้กดได้ */}
                          <Link href={`/students/${s.student_id}`} target="_blank" className="group block cursor-pointer">
                            <div className="font-bold text-gray-800 text-base group-hover:text-purple-600 transition-colors flex items-center gap-2">
                              {s.name}
                              {/* ไอคอนลูกศร (จะโผล่มาตอน Hover) */}
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-300 group-hover:text-purple-500 opacity-0 group-hover:opacity-100 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </div>
                            
                            <div className="text-gray-400 text-xs mt-0.5 flex items-center gap-2">
                              <span className="bg-gray-100 px-1.5 rounded group-hover:bg-purple-50 transition-colors">
                                {s.student_id}
                              </span>
                              <span>{course?.courses?.title || '-'}</span>
                            </div>
                          </Link>
                        </td>
                        
                        <td className="p-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full font-bold text-sm ${
                            isLow ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'
                          }`}>
                            {hours}
                          </span>
                        </td>

                        <td className="p-4 text-right">
                          {enrollmentId ? (
                            <form 
                              id={`form-${enrollmentId}`}
                              action={(formData) => handleTopUp(formData, s.name)} 
                              className="flex justify-end gap-2 items-center"
                            >
                              <input type="hidden" name="enrollmentId" value={enrollmentId} />
                              <input 
                                type="number" 
                                name="hours" 
                                placeholder="+ชม." 
                                className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-center text-sm focus:ring-2 focus:ring-purple-500 outline-none transition"
                                required
                                min="1"
                              />
                              <button 
                                type="submit" 
                                disabled={topUpLoading === enrollmentId}
                                className="bg-purple-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition shadow-sm hover:shadow"
                              >
                                {topUpLoading === enrollmentId ? '...' : 'เติม'}
                              </button>
                            </form>
                          ) : (
                            <span className="text-gray-300 text-xs italic">ยังไม่ลงคอร์ส</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {students.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-gray-400">ยังไม่มีข้อมูลนักเรียน</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sidebar: ประวัติการเข้าเรียน */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 h-fit">
            <h2 className="text-lg font-bold mb-6 text-gray-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
              เข้าเรียนล่าสุด
            </h2>
            <div className="space-y-4 relative">
              {/* เส้นเชื่อม Timeline */}
              <div className="absolute left-[19px] top-2 bottom-2 w-[2px] bg-gray-100"></div>

              {logs.map((log, i) => (
                <div key={i} className="relative flex items-start gap-4">
                  {/* จุดกลมๆ หน้าชื่อ */}
                  <div className="z-10 mt-1.5 w-10 h-10 rounded-full bg-orange-50 border-4 border-white shadow-sm flex items-center justify-center shrink-0 text-lg">
                    🎓
                  </div>
                  
                  <div className="flex-1 min-w-0 bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div className="font-bold text-gray-700 truncate">
                      {(log.enrollments as any)?.students?.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 truncate">
                      {(log.enrollments as any)?.courses?.title}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-2 text-right font-medium bg-white inline-block px-2 py-0.5 rounded ml-auto">
                      {new Date(log.created_at).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})} น.
                    </div>
                  </div>
                </div>
              ))}
              
              {logs.length === 0 && (
                <div className="text-center text-gray-400 py-4 text-sm">ยังไม่มีประวัติการเข้าเรียน</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
