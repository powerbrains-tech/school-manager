'use client'

import { registerStudent } from './actions'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'

const subjectOptions = ['คณิต', 'วิทย์', 'อังกฤษ', 'ไทย', 'สังคม', 'จินตคณิต']

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)
  const [lastStudentId, setLastStudentId] = useState<string | null>(null)
  
  const [courses, setCourses] = useState<{ id: string; title: string; total_hours: number }[]>([])
  const [selectedHours, setSelectedHours] = useState<number | string>('')
  
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [isOtherChecked, setIsOtherChecked] = useState(false)
  const [otherSubject, setOtherSubject] = useState('')

  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    async function loadCourses() {
      const { data } = await supabase.from('courses').select('id, title, total_hours').order('title')
      if (data) setCourses(data)
    }
    loadCourses()
  }, [])

  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const courseId = e.target.value
    const foundCourse = courses.find(c => c.id === courseId)
    if (foundCourse) {
      setSelectedHours(foundCourse.total_hours)
    } else {
      setSelectedHours('')
    }
  }

  const handleSubjectCheckbox = (subject: string) => {
    setSelectedSubjects(prev => 
      prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
    )
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setMessage(null)
    setLastStudentId(null)

    try {
      const result = await registerStudent(formData)
      
      if (result.success) {
        // ✅ รับค่า ID จากหลังบ้านมาโชว์ให้แอดมินเห็น
        setMessage({ text: `✅ ลงทะเบียนสำเร็จ! รหัสนักเรียนใหม่คือ ${result.studentId}`, type: 'success' })
        setLastStudentId(result.studentId as string) 
        
        formRef.current?.reset()
        setSelectedHours('')
        setSelectedSubjects([])
        setIsOtherChecked(false)
        setOtherSubject('')
      } else {
        setMessage({ text: '❌ เกิดข้อผิดพลาด: ' + result.error, type: 'error' })
      }
    } catch {
      setMessage({ text: '❌ ระบบขัดข้อง กรุณาลองใหม่', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const finalSubjectsList = [
    ...selectedSubjects, 
    isOtherChecked && otherSubject.trim() ? otherSubject.trim() : ''
  ].filter(Boolean).join(', ')

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 relative py-10">
      
      <Link href="/dashboard" className="absolute top-6 left-6 flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-md text-gray-600 hover:text-green-600 hover:shadow-lg transition-all font-medium text-sm z-10">
        <span>🏠</span> กลับเมนูหลัก
      </Link>

      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        
        <div className="bg-green-600 p-6 text-center text-white">
          <div className="text-4xl mb-2">📝</div>
          <h1 className="text-xl font-bold">ลงทะเบียนนักเรียนใหม่</h1>
          <p className="text-green-100 text-sm">กรอกข้อมูลให้ครบถ้วนเพื่อเปิดคอร์สและสร้าง QR Code</p>
        </div>
        
        <div className="p-8">
          
          {message && (
            <div className={`mb-6 p-4 rounded-lg text-sm font-medium border flex flex-col gap-3 ${
              message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'
            }`}>
              <div className="flex items-center gap-2 font-bold text-lg">{message.text}</div>
              {message.type === 'success' && lastStudentId && (
                <Link href={`/students/${lastStudentId}`} target="_blank" className="bg-white text-green-700 border border-green-200 px-4 py-2 rounded-md shadow-sm text-center hover:bg-green-50 transition font-bold flex items-center justify-center gap-2 mt-2">
                  📇 เปิดดูบัตรประจำตัว (QR) ↗
                </Link>
              )}
            </div>
          )}

          <form ref={formRef} action={handleSubmit} className="space-y-5">
            
            <input type="hidden" name="enrolled_subjects" value={finalSubjectsList} />

            {/* โซนที่ 1: ข้อมูลนักเรียน */}
            <div className="space-y-4">
              <h3 className="text-md font-bold text-green-700 border-b pb-2">👤 ข้อมูลนักเรียน</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">คำนำหน้า *</label>
                  <select name="prefix" required className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-green-500 transition cursor-pointer">
                    <option value="">เลือก</option>
                    <option value="เด็กชาย">เด็กชาย</option>
                    <option value="เด็กหญิง">เด็กหญิง</option>
                    <option value="นาย">นาย</option>
                    <option value="นางสาว">นางสาว</option>
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">ชื่อ-นามสกุล *</label>
                  <input name="name" type="text" placeholder="เช่น รักเรียน เก่งมาก" required className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-green-500 outline-none transition" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">ชื่อเล่น</label>
                  <input name="nickname" type="text" placeholder="เช่น น้องต้น" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-green-500 outline-none transition" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">เบอร์โทร (นักเรียน)</label>
                  <input name="phone" type="tel" placeholder="08x-xxx-xxxx" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-green-500 outline-none transition" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">วันเดือนปีเกิด</label>
                  <input name="dob" type="date" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-green-500 outline-none transition" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">ศาสนา</label>
                  <select name="religion" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-green-500 transition cursor-pointer">
                    <option value="">-- เลือกศาสนา --</option>
                    <option value="พุทธ">พุทธ</option>
                    <option value="อิสลาม">อิสลาม</option>
                    <option value="คริสต์">คริสต์</option>
                    <option value="อื่นๆ">อื่นๆ</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">ระดับชั้น</label>
                    <select name="level" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:border-green-500 transition cursor-pointer">
                      <option value="">-- เลือกระดับชั้น --</option>
                      <option value="อนุบาล 1">อนุบาล 1</option>
                      <option value="อนุบาล 2">อนุบาล 2</option>
                      <option value="อนุบาล 3">อนุบาล 3</option>
                      <option value="ป.1">ประถมศึกษาปีที่ 1</option>
                      <option value="ป.2">ประถมศึกษาปีที่ 2</option>
                      <option value="ป.3">ประถมศึกษาปีที่ 3</option>
                      <option value="ป.4">ประถมศึกษาปีที่ 4</option>
                      <option value="ป.5">ประถมศึกษาปีที่ 5</option>
                      <option value="ป.6">ประถมศึกษาปีที่ 6</option>
                      <option value="ม.1">มัธยมศึกษาปีที่ 1</option>
                      <option value="ม.2">มัธยมศึกษาปีที่ 2</option>
                      <option value="ม.3">มัธยมศึกษาปีที่ 3</option>
                      <option value="ม.4">มัธยมศึกษาปีที่ 4</option>
                      <option value="ม.5">มัธยมศึกษาปีที่ 5</option>
                      <option value="ม.6">มัธยมศึกษาปีที่ 6</option>
                      <option value="บุคคลทั่วไป">บุคคลทั่วไป</option>
                    </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">โรงเรียน</label>
                  <input name="school_name" type="text" placeholder="เช่น โรงเรียนภูเก็ตวิทยาลัย" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:border-green-500 transition" />
                </div>
              </div>

              <div>
                 <label className="block text-sm font-semibold text-gray-700 mb-1">รูปถ่ายนักเรียน (ถ้ามี)</label>
                 <input name="photo" type="file" accept="image/*" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 transition cursor-pointer" />
              </div>
            </div>

            {/* โซนที่ 2: ข้อมูลผู้ปกครอง */}
            <div className="space-y-4 bg-gray-50 p-5 rounded-2xl border border-gray-100 mt-6">
              <h3 className="text-md font-bold text-indigo-700 border-b border-indigo-100 pb-2">👨‍👩‍👧 ข้อมูลผู้ปกครอง</h3>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">ชื่อ-สกุล ผู้ปกครอง</label>
                <input name="parent_name" type="text" placeholder="เช่น นายใจดี รักเรียน" className="w-full bg-white border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none transition" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">เบอร์โทรติดต่อ</label>
                  <input name="parent_phone" type="tel" placeholder="08x-xxx-xxxx" className="w-full bg-white border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Line ID</label>
                  <input name="parent_line_id" type="text" placeholder="เช่น id_line123" className="w-full bg-white border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                </div>
              </div>
            </div>

            {/* โซนที่ 3: ข้อมูลการสมัครเรียน */}
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <h3 className="text-md font-bold text-gray-800 border-b pb-2">📚 ข้อมูลการสมัครเรียน</h3>

              {/* ✅ ปรับปรุงจุดนี้: เอาช่องพิมพ์ออก เปลี่ยนเป็นป้ายบอกสถานะแทน */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">รหัสนักเรียน (ID)</label>
                <div className="w-full bg-gray-200 border border-gray-300 text-gray-500 rounded-xl p-3 font-bold cursor-not-allowed flex items-center gap-2">
                  <span>🚀</span> ระบบจะสร้างรหัสให้อัตโนมัติเมื่อกดบันทึก
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">คอร์สที่สมัคร *</label>
                <select name="course_id" required onChange={handleCourseChange} className="w-full bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold rounded-xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition cursor-pointer">
                  <option value="">-- เลือกคอร์สเรียน --</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>{course.title} ({course.total_hours} ชม.)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">จำนวนชั่วโมง *</label>
                <input name="hours" type="number" required value={selectedHours} onChange={(e) => setSelectedHours(e.target.value)} placeholder="จำนวนชั่วโมงเรียน" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-green-500 outline-none transition font-black text-lg text-gray-800" />
              </div>

              <div className="pt-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">รายวิชาที่เรียน (เลือกได้มากกว่า 1 วิชา)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  {subjectOptions.map(sub => (
                    <label key={sub} className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500 transition cursor-pointer" 
                        checked={selectedSubjects.includes(sub)}
                        onChange={() => handleSubjectCheckbox(sub)}
                      />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-green-700 transition">{sub}</span>
                    </label>
                  ))}
                  
                  <label className="flex items-center gap-2 cursor-pointer col-span-2 sm:col-span-3 mt-2 pt-3 border-t border-gray-100 group">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500 transition cursor-pointer flex-shrink-0" 
                      checked={isOtherChecked}
                      onChange={(e) => {
                        setIsOtherChecked(e.target.checked)
                        if (!e.target.checked) setOtherSubject('') 
                      }}
                    />
                    <span className="text-sm font-medium text-gray-700 w-10 flex-shrink-0 group-hover:text-green-700 transition">อื่นๆ</span>
                    
                    <div className={`flex-1 transition-all overflow-hidden ${isOtherChecked ? 'opacity-100 h-auto' : 'opacity-0 h-0'}`}>
                      <input 
                        type="text" 
                        placeholder="พิมพ์ชื่อวิชา..." 
                        value={otherSubject} 
                        onChange={e => setOtherSubject(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200 text-sm transition"
                      />
                    </div>
                  </label>
                </div>
              </div>

            </div>

            <button type="submit" disabled={loading} className="w-full bg-green-600 text-white font-black text-lg py-4 rounded-xl shadow-lg hover:bg-green-700 hover:shadow-xl transition-all disabled:opacity-50 active:scale-95 mt-6 flex justify-center items-center gap-2">
              {loading ? (
                 <><div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div> กำลังบันทึก...</>
              ) : '✅ บันทึกและสร้างคอร์ส'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}