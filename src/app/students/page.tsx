'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'
import Image from 'next/image'

// กำหนด Type ให้ข้อมูลเพื่อความชัวร์และป้องกัน Error
type Course = { title: string }
type Enrollment = { courses: Course | null }
type Student = {
  id: string
  student_id: string
  name: string
  nickname: string | null
  level: string | null
  image_url: string | null
  enrollments: Enrollment[]
}

export default function StudentListPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchStudents()
  }, [])

  async function fetchStudents() {
    // ดึงข้อมูลนักเรียนทั้งหมด + คอร์ส
    const { data, error } = await supabase
      .from('students')
      .select('*, enrollments (courses (title))')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching students:', error)
    } else if (data) {
      setStudents(data as Student[])
    }
    setLoading(false)
  }

  // 🔍 ฟังก์ชันกรองรายชื่อฉลาดขึ้น (หาจาก ชื่อ, รหัส, ชื่อเล่น, ระดับชั้น ได้หมด)
  const filteredStudents = students.filter(s => {
    const search = searchTerm.toLowerCase()
    return (
      s.name.toLowerCase().includes(search) || 
      s.student_id.toLowerCase().includes(search) ||
      (s.nickname && s.nickname.toLowerCase().includes(search)) ||
      (s.level && s.level.toLowerCase().includes(search))
    )
  })

  return (
    <div className="min-h-screen bg-gray-50 p-6 relative pb-20">
      
      <div className="max-w-4xl mx-auto">
        {/* ปุ่มกลับ Dashboard */}
        <Link href="/dashboard" className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm text-gray-500 hover:text-indigo-600 hover:shadow-md transition-all font-bold text-sm mb-6 border border-gray-100">
          <span>🔙</span> กลับหน้าหลัก
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
                <h1 className="text-3xl font-black text-gray-800 tracking-tight flex items-center gap-3">
                    📋 รายชื่อนักเรียน
                </h1>
                <p className="text-gray-500 mt-1 font-medium">จัดการและค้นหาข้อมูลนักเรียนทั้งหมดในระบบ</p>
            </div>
            <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-gray-200 text-center flex-shrink-0">
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">นักเรียนทั้งหมด</span>
                <span className="block text-2xl font-black text-indigo-600">{students.length} <span className="text-sm text-gray-500 font-medium">คน</span></span>
            </div>
        </div>

        {/* ช่องค้นหา */}
        <div className="relative mb-8 group">
          <input
            type="text"
            placeholder="🔍 ค้นหาชื่อ, รหัส, ชื่อเล่น หรือ ระดับชั้น..."
            className="w-full p-4 pl-12 rounded-2xl border-2 border-gray-100 shadow-sm focus:border-indigo-500 focus:ring-0 outline-none text-base font-medium transition-colors bg-white group-hover:border-gray-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="absolute left-4 top-4 text-xl opacity-60">🔎</span>
          {searchTerm && (
             <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-4 bg-gray-100 text-gray-500 hover:bg-gray-200 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold transition"
             >
                ✖
             </button>
          )}
        </div>

        {/* รายการนักเรียน */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
             <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
             <p className="text-gray-400 font-medium">กำลังโหลดข้อมูลนักเรียน...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredStudents.map((student) => (
              <Link key={student.id} href={`/students/${student.student_id}`}>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex justify-between items-center group relative overflow-hidden">
                  
                  {/* แถบสีตกแต่งด้านซ้าย */}
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gray-100 group-hover:bg-indigo-500 transition-colors"></div>

                  <div className="flex items-center gap-4 pl-2 overflow-hidden w-full">
                    
                    {/* รูปโปรไฟล์ หรือ ตัวอักษรย่อ */}
                    <div className="relative w-14 h-14 flex-shrink-0 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-xl border border-indigo-100 group-hover:bg-indigo-100 transition-colors overflow-hidden shadow-inner">
                      {student.image_url ? (
                        <Image src={student.image_url} alt={student.name} fill sizes="56px" className="object-cover" />
                      ) : (
                        student.nickname ? student.nickname.charAt(0) : student.name.charAt(0)
                      )}
                    </div>

                    <div className="truncate pr-2 w-full">
                      <h3 className="font-bold text-gray-800 text-base group-hover:text-indigo-600 transition-colors truncate">
                        {student.name}
                        {student.nickname && <span className="text-gray-400 font-medium ml-1">({student.nickname})</span>}
                      </h3>
                      
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-500 font-bold font-mono bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                          {student.student_id}
                        </span>
                        {student.level && (
                          <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                            {student.level}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ข้อมูลคอร์ส */}
                  <div className="text-right flex flex-col items-end flex-shrink-0">
                     {student.enrollments && student.enrollments.length > 0 ? (
                        <div className="bg-green-50 border border-green-100 px-2 py-1 rounded-lg text-center">
                           <span className="block text-[9px] text-green-600 font-bold uppercase tracking-wider">คอร์สเรียน</span>
                           <span className="block text-sm font-black text-green-700 leading-none mt-0.5">{student.enrollments.length}</span>
                        </div>
                     ) : (
                        <div className="bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg text-center opacity-70">
                           <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">คอร์สเรียน</span>
                           <span className="block text-sm font-black text-gray-400 leading-none mt-0.5">0</span>
                        </div>
                     )}
                  </div>

                </div>
              </Link>
            ))}
            
            {/* กรณีค้นหาไม่เจอ */}
            {filteredStudents.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
                <span className="text-5xl mb-4 opacity-20">🕵️‍♂️</span>
                <p className="text-gray-500 font-medium">ไม่พบข้อมูลนักเรียนที่คุณค้นหา</p>
                <button 
                  onClick={() => setSearchTerm('')}
                  className="mt-4 text-sm text-indigo-600 font-bold hover:underline"
                >
                  ล้างการค้นหา
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}