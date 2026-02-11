'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { updateStudentPhoto, updateStudentInfo, deleteStudent } from './actions'
import { QRCodeSVG } from 'qrcode.react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

type Course = {
  id: number
  title: string | null
}

type Enrollment = {
  id: number
  remaining_hours: number
  courses: Course | null
}

type StudentRecord = {
  id: string
  name: string
  student_id: string
  nickname: string | null
  phone: string | null
  image_url: string | null
  enrollments: Enrollment[]
}

type AttendanceLog = {
  id: number
  enrollment_id: number
  subject_id: number | null
  created_at: string
}

type HistoryItem = AttendanceLog & {
  subject_name: string
  course_title: string
}

type Subject = {
  id: number
  name: string
}

export default function StudentProfile() {
  const params = useParams<{ id: string | string[] }>()
  const router = useRouter()
  const [student, setStudent] = useState<StudentRecord | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = Array.isArray(params.id) ? params.id[0] : params.id
    if (id) fetchData(id)
  }, [params.id])

  // --- ฟังก์ชันดึงข้อมูล (หัวใจหลักที่แก้บั๊กให้แล้ว) ---
  async function fetchData(id: string) {
    try {
        // 1. ดึงข้อมูลนักเรียน
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select(`
            *, 
            enrollments (
              id, 
              remaining_hours, 
              courses (title, id)
            )
          `)
          .eq('student_id', id)
          .single()

        if (studentError || !studentData) {
            console.error("❌ Error fetching student:", studentError)
            setLoading(false)
            return
        }

        const typedStudent = studentData as StudentRecord
        typedStudent.enrollments = [...(typedStudent.enrollments || [])].sort(
          (a, b) => b.id - a.id
        )
        setStudent(typedStudent)

        // 2. ดึง History (แบบ Manual Join ชัวร์ 100%)
        if (typedStudent.enrollments && typedStudent.enrollments.length > 0) {
            const enrollmentIds = typedStudent.enrollments.map((enrollment) => enrollment.id);

            // 2.1 ดึง Logs ดิบๆ
            const { data: rawLogs, error: logError } = await supabase
                .from('attendance_logs')
                .select('*')
                .in('enrollment_id', enrollmentIds)
                .order('created_at', { ascending: false })
                .limit(20)

            if (logError) {
                console.error("❌ Error fetching logs:", logError)
            } else if (rawLogs && rawLogs.length > 0) {
                // 2.2 ดึงชื่อวิชามาแปะ (Manual Map)
                const { data: subjects } = await supabase.from('subjects').select('id, name');
                const subjectMap = new Map((subjects as Subject[] | null)?.map((s) => [s.id, s.name]));
                const logs = rawLogs as AttendanceLog[]

                const formattedHistory = logs.map((log) => {
                    const enroll = typedStudent.enrollments.find((e) => e.id === log.enrollment_id);
                    const courseTitle = enroll?.courses?.title || 'Unknown Course';
                    const subjectName = subjectMap.get(log.subject_id) || 'เข้าเรียนสำเร็จ ✅'; // ถ้าไม่เจอวิชา ให้ขึ้นคำนี้แทน

                    return {
                        ...log,
                        subject_name: subjectName,
                        course_title: courseTitle
                    }
                });
                
                setHistory(formattedHistory)
            } else {
                setHistory([])
            }
        }
    } catch (err) {
        console.error("💥 Unexpected error:", err)
    } finally {
        setLoading(false)
    }
  }

  // --- ส่วนจัดการรูปภาพ ---
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !student) return

    setUploading(true)
    const formData = new FormData()
    formData.append('studentId', student.student_id)
    formData.append('photo', file)

    const result = await updateStudentPhoto(formData)
    
    if (result.success) {
      alert('✅ เปลี่ยนรูปเรียบร้อย!')
      await fetchData(student.student_id)
      router.refresh()
    } else {
      alert('❌ เปลี่ยนรูปไม่สำเร็จ: ' + result.error)
    }
    setUploading(false)
  }

  function handleImageClick() {
    if (!isEditing) fileInputRef.current?.click()
  }

  // --- ส่วนจัดการแก้ไขข้อมูล ---
  async function handleSaveInfo(formData: FormData) {
    const result = await updateStudentInfo(formData)
    if (result.success) {
      alert('✅ บันทึกข้อมูลเรียบร้อย!')
      setIsEditing(false)
      if (student) fetchData(student.student_id)
    } else {
      alert('❌ เกิดข้อผิดพลาด: ' + result.error)
    }
  }

  async function handleDelete() {
    if (!student) return;
    if (!confirm(`⚠️ คุณแน่ใจหรือไม่ที่จะลบนักเรียน "${student.name}"?\nข้อมูลการเรียนทั้งหมดจะหายไปและกู้คืนไม่ได้!`)) return
    const result = await deleteStudent(student.student_id)
    if (result.success) {
      alert('🗑️ ลบข้อมูลเรียบร้อยแล้ว')
      router.push('/students')
    } else {
      alert('❌ ลบไม่สำเร็จ: ' + result.error)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  )
  
  if (!student) return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-sm w-full">
            <div className="text-6xl mb-4">😢</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">ไม่พบข้อมูลนักเรียน</h2>
            <p className="text-gray-500 mb-6">รหัส: {params.id}</p>
            <Link href="/students" className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-full font-medium hover:bg-indigo-700 transition">
                กลับหน้ารายชื่อ
            </Link>
        </div>
      </div>
  )

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4">
      
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

      {/* Navbar */}
      <div className="max-w-md mx-auto mb-6 flex justify-between items-center no-print">
        <Link href="/students" className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition bg-white px-4 py-2 rounded-full shadow-sm text-sm font-medium">
          <span>🔙</span> กลับรายชื่อ
        </Link>
        
        <div className="flex gap-2">
           <button 
             onClick={() => setIsEditing(!isEditing)} 
             className={`px-3 py-2 rounded-full shadow-sm text-sm font-bold transition flex items-center gap-1 ${isEditing ? 'bg-gray-200 text-gray-700' : 'bg-white text-indigo-600 hover:bg-indigo-50'}`}
           >
             {isEditing ? '✖ ยกเลิก' : '✏️ แก้ไข'}
           </button>
           
           {!isEditing && (
             <button onClick={() => window.print()} className="bg-white text-gray-600 p-2 rounded-full shadow-sm hover:text-indigo-600">
               🖨️
             </button>
           )}
        </div>
      </div>

      <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200 relative print:shadow-none print:border-none">
        
        {/* Header Color */}
        <div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-600 relative">
            <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 group cursor-pointer" onClick={handleImageClick}>
                <div className="w-24 h-24 bg-white rounded-full p-1 shadow-lg overflow-hidden flex items-center justify-center bg-indigo-50 relative">
                    {uploading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 rounded-full">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                      </div>
                    )}
                    {student.image_url ? (
                      <Image
                        src={student.image_url}
                        alt={student.name}
                        fill
                        sizes="96px"
                        unoptimized
                        className="w-full h-full object-cover rounded-full group-hover:opacity-80 transition"
                      />
                    ) : (
                      <div className="text-4xl font-bold text-indigo-600 group-hover:opacity-80 transition">
                          {student.nickname ? student.nickname.charAt(0) : student.name.charAt(0)}
                      </div>
                    )}
                    
                    {!isEditing && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200 z-10 bg-black/20 rounded-full">
                            <span className="text-xl">📷</span>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Profile Info */}
        <div className="pt-14 pb-6 px-6 text-center border-b border-gray-100">
            {isEditing ? (
              // --- FORM แก้ไข ---
              <form action={handleSaveInfo} className="space-y-4 animate-fade-in-up">
                 <input type="hidden" name="studentId" value={student.student_id} />
                 <div>
                   <label className="text-xs text-gray-400 font-bold uppercase">ชื่อจริง-นามสกุล</label>
                   <input name="name" defaultValue={student.name} className="w-full text-center border-b-2 border-indigo-200 focus:border-indigo-600 outline-none py-2 font-bold text-gray-800 bg-gray-50 rounded-t-md transition-colors" placeholder="ระบุชื่อ-นามสกุล"/>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="text-xs text-gray-400 font-bold uppercase">ชื่อเล่น</label>
                     <input name="nickname" defaultValue={student.nickname} className="w-full text-center border-b-2 border-indigo-200 focus:border-indigo-600 outline-none py-2 text-sm bg-gray-50 rounded-t-md transition-colors" placeholder="ระบุชื่อเล่น"/>
                   </div>
                   <div>
                     <label className="text-xs text-gray-400 font-bold uppercase">เบอร์โทร</label>
                     <input name="phone" defaultValue={student.phone} className="w-full text-center border-b-2 border-indigo-200 focus:border-indigo-600 outline-none py-2 text-sm bg-gray-50 rounded-t-md transition-colors" placeholder="ระบุเบอร์โทร"/>
                   </div>
                 </div>

                 <div className="bg-indigo-50/50 p-4 rounded-xl mt-4 border border-indigo-100">
                    <h3 className="text-sm font-bold text-indigo-800 uppercase tracking-wider mb-3 text-left">📚 แก้ไขคอร์สเรียน</h3>
                    <div className="space-y-4">
                       {student.enrollments.map((enroll) => (
                           <div key={enroll.id} className="bg-white p-4 rounded-xl shadow-sm border border-indigo-100 text-left">
                               <div className="mb-3">
                                   <label className="text-[10px] text-gray-400 font-bold uppercase">ชื่อวิชา (ID: {enroll.courses.id})</label>
                                   <input name={`course-title-${enroll.courses.id}`} defaultValue={enroll.courses.title} className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:border-indigo-500 outline-none font-medium text-indigo-700" />
                               </div>
                               <div>
                                   <label className="text-[10px] text-gray-400 font-bold uppercase">ชั่วโมงคงเหลือ</label>
                                   <input type="number" name={`course-hours-${enroll.id}`} defaultValue={enroll.remaining_hours} className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:border-indigo-500 outline-none font-bold" />
                               </div>
                           </div>
                       ))}
                    </div>
                 </div>

                 <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-indigo-700 transition transform active:scale-[0.98]">💾 บันทึกการเปลี่ยนแปลง</button>
                 
                 <div className="mt-8 pt-4 border-t border-red-100">
                    <button type="button" onClick={handleDelete} className="w-full bg-white border border-red-300 text-red-600 py-3 rounded-xl text-sm font-bold hover:bg-red-600 hover:text-white transition shadow-sm">🗑️ ลบข้อมูลนักเรียนคนนี้ถาวร</button>
                </div>
              </form>
            ) : (
              // --- โหมดแสดงผลปกติ ---
              <>
                <h1 className="text-2xl font-bold text-gray-800">{student.name} {student.nickname && <span className="text-indigo-600 text-lg ml-2">({student.nickname})</span>}</h1>
                <div className="flex justify-center gap-2 mt-2">
                  <span className="text-gray-500 text-sm bg-gray-100 px-3 py-1 rounded-full font-mono">ID: {student.student_id}</span>
                  {student.phone && <a href={`tel:${student.phone}`} className="text-white text-sm bg-green-500 px-3 py-1 rounded-full hover:bg-green-600 transition flex items-center gap-1">📞 {student.phone}</a>}
                </div>
              </>
            )}

            {!isEditing && (
                <div className="mt-8 space-y-3">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider text-left pl-1 mb-2">📚 คอร์สเรียน</h3>
                    {student.enrollments && student.enrollments.length > 0 ? (
                    student.enrollments.map((enroll, index) => (
                        <div key={index} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center hover:shadow-md transition-shadow">
                            <div className="text-left overflow-hidden">
                                <p className="text-indigo-700 font-bold text-sm truncate pr-2">{enroll.courses?.title}</p>
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider">{enroll.remaining_hours > 0 ? 'Active' : 'Completed'}</p>
                            </div>
                            <div className={`flex-shrink-0 px-3 py-1.5 rounded-lg border ${enroll.remaining_hours < 5 ? 'bg-red-50 border-red-100 text-red-700' : 'bg-green-50 border-green-100 text-green-700'}`}>
                                <div className="text-center">
                                    <span className="block text-[10px] opacity-70 uppercase font-bold leading-tight">คงเหลือ</span>
                                    <span className="block text-lg font-black leading-tight">{enroll.remaining_hours}</span>
                                </div>
                            </div>
                        </div>
                    ))
                    ) : (
                    <div className="p-4 bg-gray-50 rounded-xl text-gray-400 italic text-sm border border-gray-100">ยังไม่ได้ลงทะเบียนเรียนคอร์สใดๆ</div>
                    )}
                </div>
            )}
        </div>

        {/* Timeline & QR Code */}
        {!isEditing && (
          <>
            <div className="p-6 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">📅 ประวัติการเข้าเรียนล่าสุด</h3>
              <div className="space-y-0 relative border-l-2 border-gray-200 ml-3">
                {history.map((log, i) => (
                  <div key={i} className="mb-6 ml-6 relative group">
                    <span className="absolute -left-[31px] top-1 bg-white border-2 border-indigo-500 w-4 h-4 rounded-full group-hover:scale-110 transition-transform"></span>
                    <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 group-hover:border-indigo-200 transition-colors">
                      <p className="text-xs text-gray-400 mb-1">
                        {new Date(log.created_at).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short', year: '2-digit' })}
                      </p>
                      <div className="flex justify-between items-center">
                        <div>
                            {/* ตรงนี้แหละครับที่ดึงชื่อวิชามาโชว์ */}
                            <span className="font-bold text-gray-700 text-sm block">
                                {log.subject_name || 'เข้าเรียนสำเร็จ ✅'}
                            </span>
                            <span className="text-[10px] text-gray-500">{log.course_title}</span>
                        </div>
                        <div className="text-right">
                             <span className="block text-xs font-bold text-red-500">-1.5 ชม.</span>
                             <span className="text-indigo-600 font-mono text-[10px] bg-indigo-50 px-2 py-0.5 rounded inline-block mt-1">
                                {new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                             </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {history.length === 0 && (
                    <div className="ml-6 py-4 px-4 bg-white rounded-lg border border-dashed border-gray-300 text-gray-400 text-sm italic text-center">
                        ยังไม่มีประวัติการเข้าเรียน
                    </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex flex-col items-center bg-white print:hidden">
                 <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-4">Student QR Code</p>
                 <div className="p-2 bg-white border border-gray-100 rounded-xl shadow-sm">
                    <QRCodeSVG value={student.student_id} size={140} level="H" />
                 </div>
                 <p className="text-[10px] text-gray-300 mt-2">ID: {student.student_id}</p>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
