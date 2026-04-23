'use client'

import { useState, useEffect } from 'react'
import { searchActiveStudents, deductCourseHours, getSubjects } from './actions'
import Link from 'next/link'
import Image from 'next/image'

export default function CheckinPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [processingId, setProcessingId] = useState<number | null>(null)
  
  // ✅ State สำหรับเก็บรายชื่อวิชา และวิชาที่ถูกเลือกในแต่ละคอร์ส
  const [subjects, setSubjects] = useState<{id: number, name: string}[]>([])
  const [selectedSubjects, setSelectedSubjects] = useState<Record<number, string>>({})

  // โหลดรายชื่อวิชาตอนเปิดหน้าเว็บ
  useEffect(() => {
    getSubjects().then(setSubjects)
  }, [])

  // ค้นหาอัตโนมัติเมื่อพิมพ์ชื่อ
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true)
        const data = await searchActiveStudents(searchQuery)
        setResults(data)
        setIsSearching(false)
      } else {
        setResults([])
      }
    }, 500)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery])

  // ✂️ กดตัดชั่วโมง
  const handleDeduct = async (enrollmentId: number, courseTitle: string, hours: number) => {
    const subjId = selectedSubjects[enrollmentId]
    let subjNameDisplay = ''
    
    // ดึงชื่อวิชามาแสดงในกล่อง Confirm ให้ชัดเจน
    if (subjId) {
      const subjectDetail = subjects.find(s => s.id.toString() === subjId)
      if (subjectDetail) {
        subjNameDisplay = `\n📚 เรียนวิชา: ${subjectDetail.name}`
      }
    }

    if (!confirm(`ยืนยันการตัดชั่วโมง "${courseTitle}"\n⏳ จำนวน ${hours} ชม.${subjNameDisplay}`)) return
    
    setProcessingId(enrollmentId)
    // ส่ง id วิชาไปด้วยตอนตัดชั่วโมง
    const result = await deductCourseHours(enrollmentId, hours, subjId)
    
    if (result.success) {
      alert(`✅ ตัดชั่วโมงสำเร็จ! คงเหลือ ${result.remaining} ชม.`)
      
      // ล้างค่าวิชาที่เลือก และรีเฟรชข้อมูลค้นหา
      setSelectedSubjects(prev => ({...prev, [enrollmentId]: ''}))
      const updatedData = await searchActiveStudents(searchQuery)
      setResults(updatedData)
    } else {
      alert(`❌ เกิดข้อผิดพลาด: ${result.error}`)
    }
    setProcessingId(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 py-10 font-sans pb-20">
      <div className="max-w-3xl mx-auto">
        
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition font-bold text-sm mb-6 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
          <span>🔙</span> กลับหน้าหลัก
        </Link>

        {/* ส่วนหัวและช่องค้นหา */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-indigo-100 mb-8 text-center relative overflow-hidden">
          <div className="absolute -right-10 -top-10 text-9xl opacity-5">🛎️</div>
          
          <h1 className="text-3xl font-black text-indigo-900 tracking-tight mb-2 relative z-10">
            ระบบเช็คชื่อหน้าเคาน์เตอร์
          </h1>
          <p className="text-gray-500 font-medium mb-8 relative z-10">ค้นหาชื่อ, ชื่อเล่น หรือรหัสนักเรียน เพื่อหักชั่วโมงเรียน</p>

          <div className="relative max-w-xl mx-auto z-10">
            <input 
              type="text" 
              placeholder="🔍 พิมพ์ชื่อนักเรียน หรือรหัส S001..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full bg-gray-50 border-2 border-indigo-100 focus:border-indigo-500 rounded-2xl px-6 py-4 outline-none font-bold text-lg text-gray-800 shadow-inner transition-all"
            />
            {isSearching && (
              <div className="absolute right-4 top-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
              </div>
            )}
            {searchQuery && (
              <button 
                onClick={() => { setSearchQuery(''); setResults([]); }}
                className="absolute right-4 top-4 w-7 h-7 bg-gray-200 text-gray-600 rounded-full font-bold hover:bg-red-100 hover:text-red-500 transition"
              >✕</button>
            )}
          </div>
        </div>

        {/* แสดงผลลัพธ์การค้นหา */}
        {searchQuery.length > 0 && searchQuery.length < 2 && (
          <p className="text-center text-gray-400 font-bold mt-4 animate-pulse">พิมพ์อีกนิดเพื่อค้นหา...</p>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-wider mb-2 ml-2">ผลการค้นหา ({results.length} คน)</h2>
            
            {results.map(student => (
              <div key={student.id} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 hover:border-indigo-200 transition-colors">
                
                {/* ข้อมูลเด็ก */}
                <div className="flex items-center gap-4 mb-4 border-b border-gray-50 pb-4">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-black text-xl shadow-inner border border-indigo-100 relative overflow-hidden">
                    {student.image_url ? (
                      <Image src={student.image_url} alt={student.name} fill className="object-cover" />
                    ) : (
                      student.nickname ? student.nickname.charAt(0) : student.name.charAt(0)
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-black text-gray-900">{student.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">น้อง{student.nickname || '-'}</span>
                      <span className="text-[10px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">ID: {student.student_id}</span>
                    </div>
                  </div>
                  
                  <Link href={`/students/${student.student_id}`} className="text-[10px] font-bold text-gray-400 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 px-3 py-2 rounded-xl transition">
                    ดูโปรไฟล์ ↗
                  </Link>
                </div>

                {/* รายวิชาที่เรียนอยู่ */}
                <div className="space-y-3">
                  {!student.enrollments || student.enrollments.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2 bg-gray-50 rounded-xl border border-dashed border-gray-200">ยังไม่ได้ลงทะเบียนคอร์สใดๆ</p>
                  ) : (
                    student.enrollments.map((enroll: any) => {
                      const isLow = enroll.remaining_hours <= 3;
                      const isZero = enroll.remaining_hours <= 0;

                      return (
                        <div key={enroll.id} className={`flex flex-col sm:flex-row justify-between p-4 rounded-2xl border ${isZero ? 'bg-gray-50 border-gray-200' : isLow ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'} gap-3`}>
                          
                          <div className="flex-1">
                            <p className={`font-black text-sm ${isZero ? 'text-gray-400' : 'text-gray-800'}`}>
                              {enroll.courses?.title}
                            </p>
                            <p className={`text-xs font-bold mt-1 ${isZero ? 'text-gray-400' : isLow ? 'text-orange-600' : 'text-indigo-600'}`}>
                              เหลือ {enroll.remaining_hours} ชม.
                            </p>
                          </div>

                          {/* ส่วนจัดการตัดชั่วโมง (เลือกวิชา + ปุ่มตัด) */}
                          {!isZero && (
                            <div className="flex flex-col gap-2 items-end">
                              
                              {/* ✅ Dropdown เลือกวิชา (แสดงผลเฉพาะคอร์สที่ไม่หมดชั่วโมง) */}
                              <select
                                className="text-xs font-bold text-indigo-900 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-300 w-full sm:w-48 cursor-pointer"
                                value={selectedSubjects[enroll.id] || ''}
                                onChange={(e) => setSelectedSubjects({...selectedSubjects, [enroll.id]: e.target.value})}
                              >
                                <option value="">-- ไม่ระบุวิชา --</option>
                                {subjects.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>

                              {/* ปุ่มตัดชั่วโมงด่วน */}
                              <div className="flex gap-1 w-full sm:w-auto justify-end">
                                <button 
                                  onClick={() => handleDeduct(enroll.id, enroll.courses?.title, 1)}
                                  disabled={processingId === enroll.id}
                                  className="flex-1 sm:flex-none px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-indigo-600 transition disabled:opacity-50 active:scale-95 shadow-sm"
                                >
                                  - 1 ชม.
                                </button>
                                <button 
                                  onClick={() => handleDeduct(enroll.id, enroll.courses?.title, 1.5)}
                                  disabled={processingId === enroll.id}
                                  className="flex-1 sm:flex-none px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-indigo-600 transition disabled:opacity-50 active:scale-95 shadow-sm"
                                >
                                  - 1.5 ชม.
                                </button>
                                <button 
                                  onClick={() => handleDeduct(enroll.id, enroll.courses?.title, 2)}
                                  disabled={processingId === enroll.id}
                                  className="flex-1 sm:flex-none px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-indigo-600 transition disabled:opacity-50 active:scale-95 shadow-sm"
                                >
                                  - 2 ชม.
                                </button>
                              </div>
                            </div>
                          )}
                          
                          {isZero && (
                            <div className="flex items-center">
                              <span className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
                                ⚠️ ชั่วโมงหมดแล้ว
                              </span>
                            </div>
                          )}

                        </div>
                      )
                    })
                  )}
                </div>

              </div>
            ))}
          </div>
        )}

        {results.length === 0 && searchQuery.length >= 2 && !isSearching && (
          <div className="text-center py-10 bg-white rounded-3xl border border-gray-100 shadow-sm mt-4">
            <span className="text-4xl mb-2 opacity-50 block">🧐</span>
            <p className="text-gray-500 font-bold">ไม่พบนักเรียนที่ค้นหา</p>
            <p className="text-xs text-gray-400 mt-1">ลองตรวจสอบตัวสะกด หรือค้นหาด้วยรหัสนักเรียนแทน</p>
          </div>
        )}

      </div>
    </div>
  )
}