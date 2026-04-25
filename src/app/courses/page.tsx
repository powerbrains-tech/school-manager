'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'
import Image from 'next/image'
import { addCourse, deleteCourse, updateCourse } from './actions'

type Student = {
  student_id: string
  name: string
  nickname: string | null
  image_url: string | null
  level: string | null
}

type Course = {
  id: string
  title: string
  type: 'hourly' | 'monthly' | 'private' // ✅ เพิ่ม private
  total_hours: number | null
  duration_months: number | null
  totalEnrolled: number
  activeEnrolled: number
  students: { student: Student; remaining_hours: number }[]
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null)
  
  // State สำหรับสร้างคอร์สใหม่
  const [saving, setSaving] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [courseType, setCourseType] = useState<'hourly' | 'monthly' | 'private'>('hourly')

  // State สำหรับแก้ไขคอร์ส
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [updating, setUpdating] = useState(false)
  const [editCourseType, setEditCourseType] = useState<'hourly' | 'monthly' | 'private'>('hourly')

  useEffect(() => {
    fetchCoursesData()
  }, [])

  async function fetchCoursesData() {
    setLoading(true)
    try {
      const { data: coursesTable, error: coursesError } = await supabase
        .from('courses')
        .select('*')

      if (coursesError) throw coursesError

      const { data: enrollmentsTable, error: enrollError } = await supabase
        .from('enrollments')
        .select(`
          id, remaining_hours,
          courses ( id ),
          students ( student_id, name, nickname, image_url, level )
        `)

      if (enrollError) throw enrollError

      const rawEnrollments = enrollmentsTable as any[] || []

      const mergedCourses: Course[] = (coursesTable || []).map((course: any) => {
        const enrolledInThisCourse = rawEnrollments.filter(e => e.courses?.id === course.id && e.students)

        return {
          ...course,
          type: course.type || 'hourly', 
          totalEnrolled: enrolledInThisCourse.length,
          activeEnrolled: enrolledInThisCourse.filter(e => e.remaining_hours > 0).length,
          students: enrolledInThisCourse.map(e => ({
            student: e.students,
            remaining_hours: e.remaining_hours
          })).sort((a, b) => b.remaining_hours - a.remaining_hours)
        }
      })

      // เรียงคอร์สตามชื่อ
      mergedCourses.sort((a, b) => a.title.localeCompare(b.title, 'th'))
      setCourses(mergedCourses)
      
    } catch (error) {
      console.error('Error fetching courses:', error)
    } finally {
      setLoading(false)
    }
  }

  function toggleExpand(courseId: string) {
    setExpandedCourse(expandedCourse === courseId ? null : courseId)
  }

  const handleAddCourse = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    formData.set('type', courseType)

    const result: any = await addCourse(formData)
    if (result.success) {
      formRef.current?.reset()
      setCourseType('hourly') 
      fetchCoursesData()
    } else {
      alert(`เกิดข้อผิดพลาด: ${result.error}`)
    }
    setSaving(false)
  }

  const handleDelete = async (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation()
    if (!confirm(`คุณแน่ใจหรือไม่ที่จะลบคอร์ส "${title}" ออกจากระบบ?`)) return
    const result: any = await deleteCourse(id)
    if (result.success) {
      fetchCoursesData()
    } else {
      alert(result.error || 'เกิดข้อผิดพลาดในการลบ')
    }
  }

  const handleUpdateCourse = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setUpdating(true)
    const formData = new FormData(e.currentTarget)
    formData.set('type', editCourseType)

    const result: any = await updateCourse(formData)
    if (result.success) {
      setEditingCourse(null)
      fetchCoursesData()
    } else {
      alert(`เกิดข้อผิดพลาด: ${result.error}`)
    }
    setUpdating(false)
  }

  const openEditModal = (course: Course) => {
    setEditingCourse(course)
    setEditCourseType(course.type || 'hourly')
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 font-sans pb-20">
      <div className="max-w-6xl mx-auto">
        
        {/* Navbar */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition font-bold text-sm mb-4 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
              <span>🔙</span> กลับหน้าหลัก
            </Link>
            <h1 className="text-3xl font-black text-gray-800 tracking-tight flex items-center gap-3">
               📚 จัดการคอร์สเรียน
            </h1>
            <p className="text-gray-500 mt-1 font-medium">เพิ่มคอร์สใหม่ และดูรายชื่อนักเรียนในแต่ละคอร์ส</p>
          </div>
          <div className="bg-white px-5 py-2.5 rounded-2xl shadow-sm border border-gray-200 text-center flex items-center gap-4">
             <div className="text-left">
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">คอร์สทั้งหมด</span>
                <span className="block text-2xl font-black text-indigo-600 leading-none mt-1">{courses.length}</span>
             </div>
             <div className="w-px h-8 bg-gray-200"></div>
             <div className="text-left">
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">นักเรียนรวม</span>
                <span className="block text-2xl font-black text-green-600 leading-none mt-1">
                    {courses.reduce((acc, curr) => acc + curr.totalEnrolled, 0)}
                </span>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* ฝั่งซ้าย: ฟอร์มสร้างคอร์สใหม่ */}
            <div className="md:col-span-1">
                <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-gray-100 sticky top-8">
                    <h2 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">✨ สร้างคอร์สใหม่</h2>
                    
                    <form ref={formRef} onSubmit={handleAddCourse} className="space-y-5">
                        
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">ชื่อคอร์สเรียน *</label>
                            <input 
                                type="text" name="title" required placeholder="เช่น ติวเข้ม ม.1"
                                className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors font-medium text-sm text-gray-800"
                            />
                        </div>

                        {/* ✅ อัปเดต: เพิ่มปุ่มคอร์สส่วนตัวเป็น 3 คอลัมน์ */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">รูปแบบการคิดเวลา *</label>
                            <div className="grid grid-cols-3 gap-2">
                              <label className={`flex flex-col items-center justify-center p-2 md:p-3 rounded-xl border-2 cursor-pointer transition-all ${courseType === 'hourly' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-gray-100 bg-white text-gray-400 hover:bg-gray-50'}`}>
                                <input type="radio" name="type" value="hourly" className="hidden" checked={courseType === 'hourly'} onChange={() => setCourseType('hourly')} />
                                <span className="text-lg md:text-xl mb-1">⏱️</span>
                                <span className="text-[10px] md:text-xs font-bold">รายชั่วโมง</span>
                              </label>
                              
                              <label className={`flex flex-col items-center justify-center p-2 md:p-3 rounded-xl border-2 cursor-pointer transition-all ${courseType === 'monthly' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-gray-100 bg-white text-gray-400 hover:bg-gray-50'}`}>
                                <input type="radio" name="type" value="monthly" className="hidden" checked={courseType === 'monthly'} onChange={() => setCourseType('monthly')} />
                                <span className="text-lg md:text-xl mb-1">📅</span>
                                <span className="text-[10px] md:text-xs font-bold">รายเดือน</span>
                              </label>

                              <label className={`flex flex-col items-center justify-center p-2 md:p-3 rounded-xl border-2 cursor-pointer transition-all ${courseType === 'private' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-gray-100 bg-white text-gray-400 hover:bg-gray-50'}`}>
                                <input type="radio" name="type" value="private" className="hidden" checked={courseType === 'private'} onChange={() => setCourseType('private')} />
                                <span className="text-lg md:text-xl mb-1">👤</span>
                                <span className="text-[10px] md:text-xs font-bold">ส่วนตัว</span>
                              </label>
                            </div>
                        </div>

                        {/* ช่องกรอกข้อมูลที่เปลี่ยนไปตามประเภทคอร์ส */}
                        <div className="animate-fade-in">
                          {courseType === 'hourly' && (
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">จำนวนชั่วโมง *</label>
                                <div className="relative">
                                  <input 
                                      type="number" name="total_hours" required min="1" placeholder="เช่น 20"
                                      className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors font-medium text-sm text-gray-800 pr-12"
                                  />
                                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">ชม.</span>
                                </div>
                            </div>
                          )}
                          
                          {courseType === 'monthly' && (
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block">อายุคอร์สเรียน *</label>
                                <div className="relative">
                                  <input 
                                      type="number" name="duration_months" required min="1" placeholder="เช่น 1, 3, 6, 12"
                                      className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-colors font-medium text-sm text-gray-800 pr-16"
                                  />
                                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">เดือน</span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-2 font-medium leading-relaxed bg-gray-50 p-2 rounded-lg border border-gray-100">
                                  * ระบบจะไม่ตัดชั่วโมงเวลาเช็คชื่อ แต่จะตรวจสอบจากวันหมดอายุแทน
                                </p>
                            </div>
                          )}

                          {/* ✅ อัปเดต: ถ้าเป็นคอร์ส Private จะโชว์คำอธิบายแทนช่องกรอก */}
                          {courseType === 'private' && (
                            <div className="bg-blue-50/80 p-4 rounded-xl border border-blue-100 text-center">
                                <span className="text-2xl mb-2 block opacity-80">📝</span>
                                <p className="text-xs text-blue-700 font-bold leading-relaxed">
                                  คอร์สส่วนตัว จะไม่มีการระบุชั่วโมงตั้งต้น<br/>
                                  คุณสามารถระบุชั่วโมงเรียนได้<br/>"ตอนที่กดรับสมัครนักเรียน"
                                </p>
                            </div>
                          )}
                        </div>

                        <button type="submit" disabled={saving} className="w-full bg-indigo-600 text-white font-black py-3.5 rounded-xl shadow-md hover:bg-indigo-700 transition active:scale-95 disabled:opacity-50 mt-2 flex justify-center items-center gap-2">
                            {saving ? 'กำลังบันทึก...' : '💾 บันทึกข้อมูล'}
                        </button>
                    </form>
                </div>
            </div>

            {/* ฝั่งขวา: รายชื่อคอร์ส */}
            <div className="md:col-span-2 space-y-4">
              {loading ? (
                <div className="py-20 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div></div>
              ) : courses.length === 0 ? (
                <div className="bg-white p-12 rounded-[2rem] text-center shadow-sm border border-gray-100">
                  <span className="text-6xl mb-4 block opacity-30">📭</span>
                  <p className="text-gray-500 font-bold">ยังไม่มีข้อมูลคอร์สเรียน</p>
                </div>
              ) : (
                courses.map((course) => (
                  <div key={course.id} className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden transition-all duration-200 hover:shadow-md hover:border-indigo-200">
                    
                    <div onClick={() => toggleExpand(course.id)} className="p-5 md:p-6 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition group relative">
                      <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="w-14 h-14 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-pink-100 flex-shrink-0">
                           {course.title.charAt(0)}
                        </div>
                        <div className="flex-1 pr-4 sm:pr-0">
                          <h2 className="text-lg font-black text-gray-800 group-hover:text-indigo-600 transition truncate">{course.title}</h2>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              <span className="text-[10px] text-gray-500 font-bold bg-gray-100 px-2 py-0.5 rounded">
                                  ผู้เรียน {course.totalEnrolled} คน
                              </span>
                              
                              {/* ✅ อัปเดต: Tag สีตามประเภท */}
                              {course.type === 'monthly' ? (
                                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                                      📅 {course.duration_months || 0} เดือน
                                  </span>
                              ) : course.type === 'private' ? (
                                  <span className="text-[10px] text-blue-600 font-bold bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                                      👤 คอร์สส่วนตัว
                                  </span>
                              ) : (
                                  <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                                      ⏱️ {course.total_hours || 0} ชม.
                                  </span>
                              )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t sm:border-t-0 pt-4 sm:pt-0 border-gray-100">
                        <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity mr-2">
                           <button onClick={(e) => { e.stopPropagation(); openEditModal(course); }} className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition border border-transparent hover:border-indigo-100 bg-gray-50 sm:bg-transparent" title="แก้ไข">✏️</button>
                           <button onClick={(e) => handleDelete(e, course.id, course.title)} className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition border border-transparent hover:border-red-100 bg-gray-50 sm:bg-transparent" title="ลบ">🗑️</button>
                        </div>

                        <div className="text-right">
                           <span className="text-[10px] font-bold text-gray-400 uppercase block leading-none mb-1">กำลังเรียน</span>
                           <span className={`text-xl font-black leading-none ${course.activeEnrolled > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                             {course.activeEnrolled} <span className="text-xs font-medium">คน</span>
                           </span>
                        </div>
                        <div className={`w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 transition-transform duration-300 ${expandedCourse === course.id ? 'rotate-180 bg-indigo-100 text-indigo-600' : ''}`}>
                           🔽
                        </div>
                      </div>
                    </div>

                    {expandedCourse === course.id && (
                      <div className="bg-gray-50/80 border-t border-gray-100 p-5 md:p-6 animate-fade-in-up">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">👥 รายชื่อผู้เรียนในคอร์ส</h3>
                        
                        {course.students.length === 0 ? (
                           <div className="text-center py-6 text-sm text-gray-400 font-medium border-2 border-dashed border-gray-200 rounded-2xl bg-white">ยังไม่มีนักเรียนลงทะเบียนคอร์สนี้</div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {course.students.map((item, idx) => (
                              <Link href={`/students/${item.student.student_id}`} key={idx}>
                                <div className="bg-white p-3 rounded-2xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition flex items-center justify-between group">
                                  <div className="flex items-center gap-3 overflow-hidden">
                                     <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold flex-shrink-0 overflow-hidden relative border border-indigo-100">
                                        {item.student.image_url ? (
                                          <Image src={item.student.image_url} alt={item.student.name} fill sizes="40px" className="object-cover" />
                                        ) : (
                                          item.student.nickname ? item.student.nickname.charAt(0) : item.student.name.charAt(0)
                                        )}
                                     </div>
                                     <div className="truncate pr-2">
                                        <p className="text-sm font-bold text-gray-800 truncate group-hover:text-indigo-600 transition">
                                          {item.student.nickname || item.student.name}
                                        </p>
                                        <p className="text-[10px] text-gray-500 font-mono mt-0.5 bg-gray-50 inline-block px-1.5 py-0.5 rounded border border-gray-100">
                                          {item.student.student_id}
                                        </p>
                                     </div>
                                  </div>

                                  {course.type === 'monthly' ? (
                                    <div className="flex-shrink-0 px-2 py-1.5 rounded-lg border bg-emerald-50 border-emerald-100 text-emerald-600 text-center min-w-[50px] shadow-sm">
                                      <span className="block text-[9px] font-bold uppercase opacity-80 leading-none mb-1">คอร์ส</span>
                                      <span className="block text-[10px] font-black leading-none">รายเดือน</span>
                                    </div>
                                  ) : (
                                    <div className={`flex-shrink-0 px-2 py-1 rounded-lg border text-center min-w-[50px] shadow-sm ${
                                       item.remaining_hours <= 0 ? 'bg-gray-50 border-gray-200 text-gray-400' :
                                       item.remaining_hours <= 3 ? 'bg-orange-50 border-orange-200 text-orange-600' :
                                       'bg-green-50 border-green-200 text-green-600'
                                    }`}>
                                       <span className="block text-[9px] font-bold uppercase opacity-80 leading-none mb-0.5">ชั่วโมง</span>
                                       <span className="block text-sm font-black leading-none">{item.remaining_hours}</span>
                                    </div>
                                  )}
                                </div>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
        </div>
      </div>

      {/* ================= MODAL แก้ไขข้อมูลคอร์ส ================= */}
      {editingCourse && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-slide-up border border-white/20">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">✏️ แก้ไขคอร์สเรียน</h2>
              <button onClick={() => setEditingCourse(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 hover:bg-gray-100 text-gray-500 font-bold transition shadow-sm active:scale-95">✕</button>
            </div>
            
            <form onSubmit={handleUpdateCourse} className="p-6 space-y-5">
              <input type="hidden" name="id" value={editingCourse.id} />
              
              <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide ml-1 mb-1.5 block">ชื่อคอร์สเรียน *</label>
                  <input 
                      type="text" name="title" required defaultValue={editingCourse.title}
                      className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors font-medium text-sm text-gray-800"
                  />
              </div>

              {/* ✅ อัปเดต: กริดปุ่มแก้ไขเป็น 3 คอลัมน์ */}
              <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide ml-1 mb-1.5 block">รูปแบบการคิดเวลา *</label>
                  <div className="grid grid-cols-3 gap-2">
                    <label className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 cursor-pointer transition-all ${editCourseType === 'hourly' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-gray-100 bg-white text-gray-400 hover:bg-gray-50'}`}>
                      <input type="radio" name="type" value="hourly" className="hidden" checked={editCourseType === 'hourly'} onChange={() => setEditCourseType('hourly')} />
                      <span className="text-lg mb-1">⏱️</span>
                      <span className="text-[10px] md:text-xs font-bold">รายชั่วโมง</span>
                    </label>
                    <label className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 cursor-pointer transition-all ${editCourseType === 'monthly' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-gray-100 bg-white text-gray-400 hover:bg-gray-50'}`}>
                      <input type="radio" name="type" value="monthly" className="hidden" checked={editCourseType === 'monthly'} onChange={() => setEditCourseType('monthly')} />
                      <span className="text-lg mb-1">📅</span>
                      <span className="text-[10px] md:text-xs font-bold">รายเดือน</span>
                    </label>
                    <label className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 cursor-pointer transition-all ${editCourseType === 'private' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-gray-100 bg-white text-gray-400 hover:bg-gray-50'}`}>
                      <input type="radio" name="type" value="private" className="hidden" checked={editCourseType === 'private'} onChange={() => setEditCourseType('private')} />
                      <span className="text-lg mb-1">👤</span>
                      <span className="text-[10px] md:text-xs font-bold">ส่วนตัว</span>
                    </label>
                  </div>
              </div>

              <div className="animate-fade-in">
                {editCourseType === 'hourly' && (
                  <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide ml-1 mb-1.5 block">จำนวนชั่วโมง *</label>
                      <div className="relative">
                        <input 
                            type="number" name="total_hours" required min="1" defaultValue={editingCourse.total_hours || ''}
                            className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors font-medium text-sm text-gray-800 pr-12"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">ชม.</span>
                      </div>
                  </div>
                )}
                {editCourseType === 'monthly' && (
                  <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide ml-1 mb-1.5 block">อายุคอร์สเรียน *</label>
                      <div className="relative">
                        <input 
                            type="number" name="duration_months" required min="1" defaultValue={editingCourse.duration_months || ''}
                            className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-colors font-medium text-sm text-gray-800 pr-16"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">เดือน</span>
                      </div>
                  </div>
                )}
                {editCourseType === 'private' && (
                  <div className="bg-blue-50/80 p-3 rounded-xl border border-blue-100 text-center">
                      <p className="text-xs text-blue-700 font-bold leading-relaxed">
                        คอร์สส่วนตัว จะระบุชั่วโมงเรียน<br/>ตอนรับสมัครนักเรียนครับ
                      </p>
                  </div>
                )}
              </div>

              <div className="pt-2 flex gap-3">
                  <button type="button" onClick={() => setEditingCourse(null)} disabled={updating} className="flex-1 bg-white border-2 border-gray-200 text-gray-600 font-bold py-3.5 rounded-xl hover:bg-gray-50 transition active:scale-95 disabled:opacity-50">
                      ยกเลิก
                  </button>
                  <button type="submit" disabled={updating} className="flex-1 bg-indigo-600 text-white font-black py-3.5 rounded-xl shadow-md hover:bg-indigo-700 transition active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2">
                      {updating ? 'กำลังบันทึก...' : '💾 บันทึก'}
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}