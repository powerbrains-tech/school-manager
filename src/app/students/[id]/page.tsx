'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { updateStudentPhoto, updateStudentInfo, deleteStudent, topUpCourse, deleteStudentEnrollment } from './actions'
import { QRCodeSVG } from 'qrcode.react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'

type Course = {
  id: number | string
  title: string | null
}

type Enrollment = {
  id: number
  remaining_hours: number
  bill_number?: string | null
  study_days?: string | null // ✅ เพิ่ม field สำหรับรองรับวันมาเรียน
  courses: Course | null
}

type StudentRecord = {
  id: string
  name: string
  student_id: string
  nickname: string | null
  phone: string | null
  level: string | null
  school_name: string | null
  image_url: string | null
  student_status: string | null
  teacher_message: string | null
  prefix: string | null
  dob: string | null
  religion: string | null
  parent_name: string | null
  parent_phone: string | null
  parent_line_id: string | null
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

type ToastType = 'success' | 'error' | 'info'

type ToastState = {
  message: string
  type: ToastType
} | null

export default function StudentProfile() {
  const params = useParams<{ id: string | string[] }>()
  const router = useRouter()

  const [student, setStudent] = useState<StudentRecord | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)

  const [availableCourses, setAvailableCourses] = useState<{id: string, title: string}[]>([])
  const [toppingUp, setToppingUp] = useState(false)
  const [expandedEnrollId, setExpandedEnrollId] = useState<number | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isBusy = uploading || saving || deleting || toppingUp

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  const showToast = useCallback((type: ToastType, message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ type, message })
    toastTimerRef.current = setTimeout(() => {
      setToast(null)
    }, 3200)
  }, [])

  const fetchData = useCallback(async (id: string) => {
    try {
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select(`
          *,
          enrollments (
            id,
            remaining_hours,
            bill_number,
            study_days, 
            courses (title, id)
          )
        `)
        .eq('student_id', id)
        .single()

      if (studentError || !studentData) {
        setStudent(null)
        setHistory([])
        showToast('error', 'โหลดข้อมูลนักเรียนไม่สำเร็จ')
        return
      }

      const typedStudent = studentData as StudentRecord
      typedStudent.enrollments = [...(typedStudent.enrollments || [])].sort((a, b) => b.id - a.id)
      setStudent(typedStudent)

      if (typedStudent.enrollments && typedStudent.enrollments.length > 0) {
        const enrollmentIds = typedStudent.enrollments.map((enrollment) => enrollment.id)

        const { data: rawLogs, error: logError } = await supabase
          .from('attendance_logs')
          .select('*')
          .in('enrollment_id', enrollmentIds)
          .order('created_at', { ascending: false })
          .limit(50) 

        if (!logError && rawLogs && rawLogs.length > 0) {
          const { data: subjects } = await supabase.from('subjects').select('id, name')
          const subjectMap = new Map((subjects as Subject[] | null)?.map((s) => [s.id, s.name]))
          
          const formattedHistory = (rawLogs as AttendanceLog[]).map((log) => {
            const enroll = typedStudent.enrollments.find((e) => e.id === log.enrollment_id)
            return {
              ...log,
              subject_name: (typeof log.subject_id === 'number' ? subjectMap.get(log.subject_id) : undefined) || 'เข้าเรียนสำเร็จ',
              course_title: enroll?.courses?.title || 'Unknown Course'
            }
          })
          setHistory(formattedHistory)
        } else {
          setHistory([])
        }
      } else {
        setHistory([])
      }

      const { data: coursesData } = await supabase.from('courses').select('id, title').order('title')
      if (coursesData) setAvailableCourses(coursesData as any[])

    } catch (err) {
      showToast('error', 'เกิดข้อผิดพลาดระหว่างโหลดข้อมูล')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    const id = Array.isArray(params.id) ? params.id[0] : params.id
    if (id) void fetchData(id)
  }, [params.id, fetchData])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !student || isBusy) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('studentId', student.student_id)
      formData.append('photo', file)
      const result = await updateStudentPhoto(formData)
      if (result.success) {
        showToast('success', 'เปลี่ยนรูปเรียบร้อย')
        await fetchData(student.student_id)
        router.refresh()
      } else {
        showToast('error', `เปลี่ยนรูปไม่สำเร็จ: ${result.error}`)
      }
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function handleImageClick() {
    if (!isEditing && !isBusy) fileInputRef.current?.click()
  }

  async function handleSaveInfo(formData: FormData) {
    if (saving || deleting) return
    setSaving(true)
    try {
      const result = await updateStudentInfo(formData)
      if (result.success) {
        showToast('success', 'บันทึกข้อมูลเรียบร้อย')
        setIsEditing(false)
        if (student) await fetchData(student.student_id)
        router.refresh()
      } else {
        showToast('error', `เกิดข้อผิดพลาด: ${result.error}`)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleTopUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (toppingUp || !student) return
    
    const form = e.currentTarget
    setToppingUp(true)
    try {
      const formData = new FormData(form)
      formData.append('studentDbId', student.id) 
      
      const result: any = await topUpCourse(formData)
      if (result.success) {
        showToast('success', '✅ สมัคร/เติมชั่วโมงสำเร็จ!')
        form.reset()
        await fetchData(student.student_id)
        router.refresh()
      } else {
        showToast('error', `❌ เติมไม่สำเร็จ: ${result.error}`)
      }
    } finally {
      setToppingUp(false)
    }
  }

  async function handleDeleteEnrollment(enrollmentId: number, courseTitle: string) {
    if (!confirm(`⚠️ ยืนยันการลบวิชา "${courseTitle}" ออกจากประวัตินักเรียน?\n\nการกระทำนี้จะลบชั่วโมงเรียนและประวัติการเข้าเรียนของวิชานี้ทิ้งทั้งหมด และไม่สามารถกู้คืนได้`)) return

    try {
      const result: any = await deleteStudentEnrollment(enrollmentId)
      if (result.success) {
        showToast('success', '🗑️ ลบคอร์สเรียนเรียบร้อยแล้ว')
        if (student) await fetchData(student.student_id)
        router.refresh()
      } else {
        showToast('error', `❌ ลบไม่สำเร็จ: ${result.error}`)
      }
    } catch (err) {
      showToast('error', 'เกิดข้อผิดพลาดในการลบ')
    }
  }

  function openDeleteDialog() {
    if (!student || saving || deleting) return
    setDeleteDialogOpen(true)
  }

  async function confirmDelete() {
    if (!student || deleting) return
    setDeleting(true)
    try {
      const result = await deleteStudent(student.student_id)
      if (result.success) {
        showToast('success', 'ลบข้อมูลเรียบร้อยแล้ว')
        router.push('/students')
        return
      }
      showToast('error', `ลบไม่สำเร็จ: ${result.error}`)
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  function closeDeleteDialog() {
    if (deleting) return
    setDeleteDialogOpen(false)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast('info', 'คัดลอกข้อมูลแล้ว')
  }

  const attendedThisMonth = history.filter(h => {
      const logDate = new Date(h.created_at)
      const now = new Date()
      return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear()
  }).length

  // ✅ ดึงวันเรียนทั้งหมดของนักเรียนคนนี้มาโชว์ที่เดียว (ป้องกันข้อมูลซ้ำ)
  const allStudyDays = Array.from(
    new Set(
      student?.enrollments
        .flatMap(e => (e.study_days ? e.study_days.split(', ') : []))
        .filter(Boolean)
    )
  )

  const toastClassName =
    toast?.type === 'success' ? 'border-green-200 bg-green-50 text-green-800'
      : toast?.type === 'error' ? 'border-red-200 bg-red-50 text-red-800'
        : 'border-blue-200 bg-blue-50 text-blue-800'

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-lg text-center max-w-sm w-full">
          <div className="text-6xl mb-4 opacity-50">😢</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">ไม่พบข้อมูลนักเรียน</h2>
          <p className="text-gray-500 mb-6">รหัส: {params.id}</p>
          <button onClick={() => router.back()} className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-full font-medium hover:bg-indigo-700 transition">
            ย้อนกลับ
          </button>
        </div>
      </div>
    )
  }

  let ageString = '-'
  if (student.dob) {
    const birthDate = new Date(student.dob)
    const ageDifMs = Date.now() - birthDate.getTime()
    const ageDate = new Date(ageDifMs)
    const years = Math.abs(ageDate.getUTCFullYear() - 1970)
    ageString = `${years} ปี`
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 font-sans print:bg-white print:py-0">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" disabled={isBusy} />

      <div className="max-w-md mx-auto mb-6 flex justify-between items-center print:hidden">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition bg-white border border-gray-200 px-4 py-2 rounded-full shadow-sm text-sm font-bold">
          <span>🔙</span> ย้อนกลับ
        </button>

        <div className="flex gap-2">
          <button onClick={() => setIsEditing((prev) => !prev)} disabled={saving || deleting} className={`px-4 py-2 rounded-full shadow-sm text-sm font-bold transition flex items-center gap-2 disabled:opacity-50 ${isEditing ? 'bg-gray-800 text-white' : 'bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50'}`}>
            {isEditing ? '✖ ยกเลิก' : '✏️ แก้ไขข้อมูล'}
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto bg-white rounded-[2rem] shadow-xl overflow-hidden border border-gray-100 relative print:shadow-none print:border-none print:w-full pb-8 print:pb-0">
        
        <div className="h-32 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 relative">
          <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-white text-xs font-bold border border-white/30 shadow-sm">
             {student.level || 'นักเรียน'}
          </div>
          <div className={`absolute -bottom-12 left-1/2 transform -translate-x-1/2 group ${!isEditing && !isBusy ? 'cursor-pointer' : ''}`} onClick={handleImageClick}>
            <div className="w-28 h-28 bg-white rounded-full p-1.5 shadow-xl overflow-hidden flex items-center justify-center bg-gray-50 relative border-4 border-white">
              {uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 rounded-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
                </div>
              )}
              {student.image_url ? (
                <Image src={student.image_url} alt={student.name} fill sizes="112px" unoptimized className="w-full h-full object-cover rounded-full group-hover:scale-105 transition duration-300" />
              ) : (
                <div className="text-4xl font-black text-indigo-300 group-hover:scale-105 transition duration-300">
                  {student.nickname ? student.nickname.charAt(0) : student.name.charAt(0)}
                </div>
              )}
              {!isEditing && !isBusy && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200 z-10 bg-black/40 rounded-full backdrop-blur-sm">
                  <span className="text-2xl drop-shadow-md">📷</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pt-16 pb-6 px-6 text-center">
          {isEditing ? (
            <form action={handleSaveInfo} className="space-y-4 animate-fade-in-up text-left">
              <fieldset disabled={saving || deleting} className="space-y-4 disabled:opacity-70">
                <input type="hidden" name="studentId" value={student.student_id} />

                {/* แก้ไขข้อมูลส่วนตัว */}
                <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100 space-y-4 shadow-inner">
                    <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1">
                            <label className="text-xs text-gray-400 font-bold uppercase ml-2 mb-1 block">คำนำหน้า</label>
                            <select name="prefix" defaultValue={student.prefix || ''} className="w-full px-3 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none py-3 font-bold text-gray-800 bg-white rounded-2xl transition-all shadow-sm">
                                <option value="">เลือก</option>
                                <option value="เด็กชาย">เด็กชาย</option>
                                <option value="เด็กหญิง">เด็กหญิง</option>
                                <option value="นาย">นาย</option>
                                <option value="นางสาว">นางสาว</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs text-gray-400 font-bold uppercase ml-2 mb-1 block">ชื่อจริง-นามสกุล</label>
                            <input name="name" defaultValue={student.name} className="w-full px-4 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none py-3 font-bold text-gray-800 bg-white rounded-2xl transition-all shadow-sm" placeholder="ระบุชื่อ-นามสกุล" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-400 font-bold uppercase ml-2 mb-1 block">ชื่อเล่น</label>
                            <input name="nickname" defaultValue={student.nickname ?? ''} className="w-full px-4 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none py-3 text-sm bg-white rounded-2xl transition-all shadow-sm" placeholder="ชื่อเล่น" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 font-bold uppercase ml-2 mb-1 block">เบอร์โทร (เด็ก)</label>
                            <input name="phone" defaultValue={student.phone ?? ''} className="w-full px-4 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none py-3 text-sm bg-white rounded-2xl transition-all shadow-sm" placeholder="เบอร์โทร" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-400 font-bold uppercase ml-2 mb-1 block">วันเดือนปีเกิด</label>
                            <input type="date" name="dob" defaultValue={student.dob ?? ''} className="w-full px-4 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none py-3 text-sm bg-white rounded-2xl transition-all shadow-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 font-bold uppercase ml-2 mb-1 block">ศาสนา</label>
                            <select name="religion" defaultValue={student.religion || ''} className="w-full px-4 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none py-3 text-sm bg-white rounded-2xl transition-all shadow-sm">
                                <option value="">-- เลือก --</option>
                                <option value="พุทธ">พุทธ</option>
                                <option value="อิสลาม">อิสลาม</option>
                                <option value="คริสต์">คริสต์</option>
                                <option value="อื่นๆ">อื่นๆ</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-400 font-bold uppercase ml-2 mb-1 block">ระดับชั้น</label>
                            <select name="level" defaultValue={student.level || ''} className="w-full px-4 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none py-3 text-sm bg-white rounded-2xl transition-all shadow-sm">
                                <option value="">- ไม่ระบุ -</option>
                                <option value="อนุบาล 1">อนุบาล 1</option><option value="อนุบาล 2">อนุบาล 2</option><option value="อนุบาล 3">อนุบาล 3</option>
                                <option value="ป.1">ป.1</option><option value="ป.2">ป.2</option><option value="ป.3">ป.3</option><option value="ป.4">ป.4</option><option value="ป.5">ป.5</option><option value="ป.6">ป.6</option>
                                <option value="ม.1">ม.1</option><option value="ม.2">ม.2</option><option value="ม.3">ม.3</option><option value="ม.4">ม.4</option><option value="ม.5">ม.5</option><option value="ม.6">ม.6</option>
                                <option value="บุคคลทั่วไป">บุคคลทั่วไป</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 font-bold uppercase ml-2 mb-1 block">โรงเรียน</label>
                            <input name="school_name" defaultValue={student.school_name ?? ''} className="w-full px-4 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none py-3 text-sm bg-white rounded-2xl transition-all shadow-sm" placeholder="โรงเรียน" />
                        </div>
                    </div>
                </div>

                {/* แก้ไขข้อมูลผู้ปกครอง */}
                <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100 space-y-4 shadow-sm">
                    <h3 className="text-sm font-black text-blue-700 uppercase tracking-wider flex items-center gap-2 mb-2">
                        👨‍👩‍👧 ข้อมูลผู้ปกครอง
                    </h3>
                    <div>
                        <label className="text-xs text-blue-500 font-bold uppercase ml-2 mb-1 block">ชื่อ-สกุล ผู้ปกครอง</label>
                        <input name="parent_name" defaultValue={student.parent_name ?? ''} className="w-full px-4 border border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none py-3 text-sm bg-white rounded-2xl transition-all shadow-sm" placeholder="เช่น แม่น้องต้น" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-blue-500 font-bold uppercase ml-2 mb-1 block">เบอร์โทรติดต่อ</label>
                            <input name="parent_phone" type="tel" defaultValue={student.parent_phone ?? ''} className="w-full px-4 border border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none py-3 text-sm bg-white rounded-2xl transition-all shadow-sm" placeholder="08x-xxx-xxxx" />
                        </div>
                        <div>
                            <label className="text-xs text-blue-500 font-bold uppercase ml-2 mb-1 block">Line ID</label>
                            <input name="parent_line_id" defaultValue={student.parent_line_id ?? ''} className="w-full px-4 border border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none py-3 text-sm bg-white rounded-2xl transition-all shadow-sm" placeholder="Line ID" />
                        </div>
                    </div>
                </div>

                <div className="bg-pink-50 p-5 rounded-3xl border border-pink-100 space-y-4 shadow-sm">
                    <h3 className="text-sm font-black text-pink-600 uppercase tracking-wider flex items-center gap-2 mb-2">
                        💬 ข้อความถึงผู้ปกครอง
                    </h3>
                    <div>
                        <label className="text-xs text-pink-400 font-bold uppercase ml-2 mb-1 block">สถานะสั้นๆ</label>
                        <input name="student_status" defaultValue={student.student_status ?? ''} className="w-full px-4 border border-pink-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-100 outline-none py-3 text-sm bg-white rounded-2xl transition-all text-pink-700 font-bold shadow-sm" placeholder="เช่น ตั้งใจเรียนมาก!" />
                    </div>
                    <div>
                        <label className="text-xs text-pink-400 font-bold uppercase ml-2 mb-1 block">ข้อความจากคุณครู</label>
                        <textarea name="teacher_message" defaultValue={student.teacher_message ?? ''} rows={3} className="w-full px-4 border border-pink-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-100 outline-none py-3 text-sm bg-white rounded-2xl transition-all resize-none shadow-sm" placeholder="พิมพ์ข้อความชื่นชม หรือข้อเสนอแนะ..." />
                    </div>
                </div>

                <div className="bg-indigo-50 p-5 rounded-3xl border border-indigo-100 shadow-sm">
                  <h3 className="text-sm font-black text-indigo-800 uppercase tracking-wider mb-4 flex items-center gap-2">📚 แก้ไขชั่วโมงเรียน (Manual)</h3>
                  <div className="space-y-3">
                    {student.enrollments.map((enroll) => {
                      if (!enroll.courses) return null
                      return (
                        <div key={enroll.id} className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-50">
                          <div className="mb-3">
                            <label className="text-[10px] text-gray-400 font-bold uppercase ml-1">ชื่อวิชา (อ่านได้อย่างเดียว)</label>
                            <div className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm font-bold text-gray-500 cursor-not-allowed">
                               {enroll.courses.title ?? 'ไม่ระบุ'}
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-indigo-500 font-bold uppercase ml-1">ชั่วโมงคงเหลือ (ชม.)</label>
                            <input type="number" step="0.5" name={`course-hours-${enroll.id}`} defaultValue={enroll.remaining_hours} className="w-full border-2 border-indigo-100 rounded-xl px-3 py-2 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none font-black text-indigo-800 transition-all bg-white" />
                          </div>
                        </div>
                      )
                    })}
                    {student.enrollments.length === 0 && (
                        <p className="text-xs text-gray-500 text-center italic py-2">ยังไม่มีคอร์สเรียน</p>
                    )}
                  </div>
                </div>

                <button type="submit" disabled={saving || deleting} className="w-full bg-gray-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-indigo-700 transition transform active:scale-[0.98] disabled:opacity-60 text-base mt-4 flex items-center justify-center gap-2">
                  {saving ? (
                      <><div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div> กำลังบันทึก...</>
                  ) : '💾 บันทึกการเปลี่ยนแปลง'}
                </button>

                <button type="button" onClick={openDeleteDialog} disabled={saving || deleting} className="w-full mt-4 bg-white border-2 border-red-100 text-red-500 py-3 rounded-2xl text-sm font-bold hover:bg-red-50 transition shadow-sm disabled:opacity-60">
                  {deleting ? 'กำลังลบ...' : '🗑️ ลบข้อมูลนักเรียนคนนี้ถาวร'}
                </button>
              </fieldset>
            </form>
          ) : (
            <>
              {/* โหมดดูข้อมูลปกติ */}
              <h1 className="text-2xl font-black text-gray-900 tracking-tight mt-2">
                {student.prefix} {student.name}
              </h1>
              <p className="text-indigo-600 font-bold mt-1 text-lg">
                {student.nickname ? `น้อง${student.nickname}` : 'นักเรียน'}
              </p>

              <div className="flex flex-wrap justify-center gap-2 mt-4">
                <button onClick={() => copyToClipboard(student.student_id)} className="text-gray-600 text-xs bg-white px-3 py-1.5 rounded-xl font-mono font-bold border border-gray-200 shadow-sm hover:border-indigo-300 hover:text-indigo-600 transition flex items-center gap-1 active:scale-95">
                  ID: {student.student_id} <span className="text-[10px]">📋</span>
                </button>
                {student.school_name && (
                  <span className="text-gray-600 text-xs bg-white px-3 py-1.5 rounded-xl font-bold border border-gray-200 shadow-sm flex items-center gap-1">
                    🏫 {student.school_name}
                  </span>
                )}
              </div>

              {/* ข้อมูลส่วนตัว (วันเกิด/ศาสนา/เบอร์เด็ก) */}
              <div className="bg-gray-50 rounded-2xl p-4 mt-5 border border-gray-100 flex flex-wrap justify-around text-center gap-y-3">
                <div className="px-3">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">อายุ</span>
                  <span className="text-sm font-black text-gray-800">{ageString}</span>
                </div>
                <div className="px-3 border-l border-gray-200">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">ศาสนา</span>
                  <span className="text-sm font-black text-gray-800">{student.religion || '-'}</span>
                </div>
                <div className="px-3 border-l border-gray-200">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">เบอร์น้อง</span>
                  <span className="text-sm font-black text-gray-800">{student.phone || '-'}</span>
                </div>
              </div>

              {/* ✅ ไฮไลท์ใหม่: แสดงวันที่มาเรียน (Study Days) */}
              {allStudyDays.length > 0 && (
                <div className="mt-4 flex flex-col items-center">
                  <span className="text-[10px] text-green-600 font-bold uppercase tracking-widest mb-2 flex items-center gap-1">
                    📅 วันที่มาเรียนปกติ
                  </span>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {allStudyDays.map(day => {
                      const isWeekend = day === 'เสาร์' || day === 'อาทิตย์'
                      return (
                        <span key={day} className={`px-2.5 py-1 text-[10px] font-black rounded-lg border ${
                          isWeekend 
                            ? 'bg-orange-50 text-orange-600 border-orange-100' 
                            : 'bg-green-50 text-green-600 border-green-100'
                        }`}>
                          {day}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ข้อมูลผู้ปกครอง */}
              {(student.parent_name || student.parent_phone || student.parent_line_id) && (
                <div className="bg-blue-50/50 rounded-2xl p-5 mt-5 border border-blue-100 text-left relative overflow-hidden">
                   <div className="absolute right-2 -bottom-2 text-6xl opacity-5">👪</div>
                   <h4 className="text-xs font-black text-blue-800 uppercase tracking-wider mb-3 flex items-center gap-2">👨‍👩‍👧 ข้อมูลผู้ปกครอง</h4>
                   
                   <div className="space-y-2">
                      {student.parent_name && (
                        <div className="flex justify-between items-center bg-white px-3 py-2 rounded-xl border border-blue-50 shadow-sm">
                          <span className="text-[10px] font-bold text-blue-400 uppercase">ชื่อ</span>
                          <span className="text-sm font-bold text-gray-800">{student.parent_name}</span>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-2">
                        {student.parent_phone && (
                          <button onClick={() => copyToClipboard(student.parent_phone!)} className="flex flex-col items-start bg-white px-3 py-2 rounded-xl border border-blue-50 shadow-sm hover:border-blue-300 transition text-left group">
                            <span className="text-[10px] font-bold text-blue-400 uppercase">เบอร์ติดต่อ</span>
                            <span className="text-sm font-bold text-gray-800 group-hover:text-blue-600 transition">{student.parent_phone}</span>
                          </button>
                        )}
                        {student.parent_line_id && (
                          <button onClick={() => copyToClipboard(student.parent_line_id!)} className="flex flex-col items-start bg-white px-3 py-2 rounded-xl border border-blue-50 shadow-sm hover:border-green-300 transition text-left group">
                            <span className="text-[10px] font-bold text-blue-400 uppercase">LINE ID</span>
                            <span className="text-sm font-bold text-gray-800 group-hover:text-green-600 transition">{student.parent_line_id}</span>
                          </button>
                        )}
                      </div>
                   </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-5 print:hidden">
                 <div className="bg-gradient-to-b from-indigo-50 to-white border border-indigo-100 rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm hover:shadow-md transition">
                    <span className="text-2xl mb-1 drop-shadow-sm">🔥</span>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">มาเรียนเดือนนี้</span>
                    <span className="text-xl font-black text-indigo-600 mt-1">{attendedThisMonth} <span className="text-xs font-bold text-indigo-400">ครั้ง</span></span>
                 </div>
                 
                 {student.student_status && (
                 <div className="bg-gradient-to-b from-orange-50 to-white border border-orange-100 rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm hover:shadow-md transition">
                    <span className="text-2xl mb-1 drop-shadow-sm">⭐</span>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">สถานะนักเรียน</span>
                    <span className="text-sm font-black text-orange-600 mt-1.5 text-center leading-tight">{student.student_status}</span>
                 </div>
                 )}
              </div>

              {student.teacher_message && (
              <div className="mt-6 bg-gradient-to-br from-pink-50 to-white border border-pink-100 rounded-2xl p-5 text-left relative overflow-hidden print:hidden shadow-sm">
                 <div className="absolute -right-2 -top-2 text-6xl opacity-10 drop-shadow-md">💬</div>
                 <h4 className="text-xs font-black text-pink-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                    💌 ข้อความจากคุณครู
                 </h4>
                 <p className="text-sm text-gray-700 font-medium italic whitespace-pre-line leading-relaxed">
                    "{student.teacher_message}"
                 </p>
              </div>
              )}

              <div className="mt-8 text-left">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                    📚 คอร์สเรียนปัจจุบัน
                    </h3>
                </div>
                
                <div className="space-y-3">
                  {student.enrollments && student.enrollments.length > 0 ? (
                    student.enrollments.map((enroll, index) => {
                      const maxHours = Math.max(enroll.remaining_hours, 20); 
                      const percent = Math.min(100, Math.max(0, (enroll.remaining_hours / maxHours) * 100));
                      const isLow = enroll.remaining_hours <= 3;
                      const isMedium = enroll.remaining_hours > 3 && enroll.remaining_hours <= 10;
                      
                      const courseHistory = history.filter(h => h.enrollment_id === enroll.id);
                      const isExpanded = expandedEnrollId === enroll.id;
                      
                      return (
                      <div key={index} className={`bg-white rounded-2xl border-2 ${isLow ? 'border-red-100 shadow-red-50' : 'border-gray-100'} shadow-sm text-left relative overflow-hidden group hover:border-indigo-100 transition-all duration-300`}>
                        
                        <div 
                          className="p-5 cursor-pointer"
                          onClick={() => setExpandedEnrollId(prev => prev === enroll.id ? null : enroll.id)}
                        >
                          <div className="flex justify-between items-end mb-3">
                             <div className="pr-4">
                                <p className="text-indigo-900 font-black text-sm transition-colors flex items-center gap-2">
                                  {enroll.courses?.title} 
                                  <span className={`text-xs text-gray-300 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-indigo-400' : ''}`}>▼</span>
                                </p>
                                {isLow && <p className="text-[10px] text-red-500 font-bold mt-1 animate-pulse flex items-center gap-1">⚠️ ชั่วโมงใกล้หมด</p>}
                             </div>
                             <div className="text-right flex-shrink-0">
                                <span className={`text-3xl font-black leading-none tracking-tight ${isLow ? 'text-red-600' : 'text-indigo-600'}`}>{enroll.remaining_hours}</span>
                                <span className="text-xs text-gray-400 font-bold ml-1">ชม.</span>
                                
                                {enroll.bill_number && (
                                  <div className="text-[10px] text-gray-400 mt-1.5 font-mono bg-gray-50 px-1.5 py-0.5 rounded">บิล: {enroll.bill_number}</div>
                                )}
                             </div>
                          </div>

                          <div className="w-full bg-gray-100 rounded-full h-2 mt-2 overflow-hidden">
                             <div 
                                className={`h-full rounded-full transition-all duration-1000 ${isLow ? 'bg-red-500' : isMedium ? 'bg-yellow-400' : 'bg-green-500'}`}
                                style={{ width: `${percent}%` }}
                             ></div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="bg-gray-50 border-t border-gray-100 p-4 animate-fade-in-up">
                            <div className="flex justify-between items-center mb-3">
                              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                🕒 ประวัติเข้าเรียน ({courseHistory.length})
                              </h4>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteEnrollment(enroll.id, enroll.courses?.title || '');
                                }}
                                className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-100 px-2 py-1 rounded hover:bg-red-100 hover:text-red-600 transition active:scale-95"
                              >
                                🗑️ ลบคอร์สนี้
                              </button>
                            </div>
                            
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                              {courseHistory.length > 0 ? (
                                courseHistory.map((log, idx) => (
                                  <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                    <div>
                                      <div className="text-xs font-bold text-gray-800">{log.subject_name || 'เข้าเรียนสำเร็จ'}</div>
                                      <div className="text-[10px] text-gray-400 mt-0.5 font-mono">
                                        {new Date(log.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} • {new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                                      </div>
                                    </div>
                                    <div className="text-[10px] font-black text-orange-500 bg-orange-50 px-2 py-1 rounded-lg border border-orange-100">
                                      -1.5 ชม.
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-center py-4 text-xs text-gray-400 font-medium border-2 border-dashed border-gray-200 rounded-xl">
                                  ยังไม่มีประวัติในคอร์สนี้
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                      </div>
                    )})
                  ) : (
                    <div className="p-6 bg-gray-50 rounded-2xl text-gray-400 font-medium text-sm border-2 border-dashed border-gray-200 text-center flex flex-col items-center justify-center">
                      <span className="text-3xl mb-2 opacity-30">📂</span>
                      ยังไม่ได้ลงทะเบียนเรียนคอร์สใดๆ
                    </div>
                  )}
                </div>

                <div className="mt-5 bg-gradient-to-br from-indigo-50 to-purple-50 p-5 rounded-2xl border border-indigo-100 shadow-inner print:hidden text-left">
                  <h4 className="text-sm font-black text-indigo-900 mb-3 flex items-center gap-2">
                    ➕ สมัครคอร์สเพิ่ม / เติมชั่วโมง
                  </h4>
                  <form onSubmit={handleTopUp} className="space-y-3">
                    <select name="course_id" required className="w-full text-sm px-4 py-3 rounded-xl border border-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200 outline-none font-bold text-indigo-900 bg-white shadow-sm transition">
                      <option value="">-- เลือกคอร์สเรียน --</option>
                      {availableCourses.map(c => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" name="hours" required min="1" placeholder="ชั่วโมง (เช่น 10)" className="w-full text-sm px-4 py-3 rounded-xl border border-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200 outline-none font-black text-indigo-900 bg-white shadow-sm text-center transition" />
                      <input type="text" name="bill_number" placeholder="เลขที่บิล (ถ้ามี)" className="w-full text-sm px-4 py-3 rounded-xl border border-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200 outline-none font-bold text-gray-700 bg-white shadow-sm text-center transition uppercase" />
                    </div>

                    <button type="submit" disabled={toppingUp} className="w-full bg-indigo-600 text-white font-black py-3.5 rounded-xl hover:bg-indigo-700 transition flex justify-center items-center gap-2 text-sm shadow-md active:scale-95 disabled:opacity-50 mt-1">
                      {toppingUp ? 'กำลังดำเนินการ...' : '✅ ยืนยันการทำรายการ'}
                    </button>
                  </form>
                </div>
              </div>

            </>
          )}
        </div>

        {!isEditing && (
          <div className="p-8 bg-gray-900 text-white flex flex-col items-center relative overflow-hidden print:bg-white print:text-black print:p-0 print:mt-8">
            <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none print:hidden">
               <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(255,255,255,0.8)_10%,transparent_10%),radial-gradient(circle,rgba(255,255,255,0.8)_10%,transparent_10%)] bg-[length:20px_20px] bg-[position:0_0,10px_10px]"></div>
            </div>

            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-5 z-10 print:text-gray-500">Student Digital Pass</p>
            
            <div className="p-4 bg-white rounded-3xl shadow-2xl z-10 print:shadow-none print:border print:border-gray-300 transform transition-transform hover:scale-105">
              <QRCodeSVG value={student.student_id} size={160} level="H" />
            </div>
            
            <p className="text-sm font-mono font-bold mt-5 tracking-widest text-indigo-300 z-10 print:text-gray-800 bg-black/30 px-4 py-1 rounded-full backdrop-blur-sm border border-white/10">{student.student_id}</p>
            
            <button 
               onClick={() => window.print()}
               className="mt-6 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-6 py-2.5 rounded-full text-xs font-bold transition-all backdrop-blur-md z-10 flex items-center gap-2 print:hidden active:scale-95 hover:shadow-lg"
            >
                💾 บันทึกภาพ / พิมพ์บัตร
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div className={`fixed top-4 right-4 z-[60] max-w-xs w-[calc(100%-2rem)] rounded-2xl border px-4 py-3 shadow-2xl ${toastClassName} animate-fade-in-up`}>
          <p className="text-sm font-bold text-center">{toast.message}</p>
        </div>
      )}

      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">⚠️</div>
            <h3 className="text-xl font-black text-gray-900">ยืนยันการลบข้อมูล?</h3>
            <p className="text-sm text-gray-600 mt-2 font-medium">
              คุณกำลังจะลบนักเรียน <br/><span className="font-bold text-red-600 text-base">"{student.name}"</span>
            </p>
            <p className="text-xs text-red-400 mt-3 bg-red-50 p-2.5 rounded-xl border border-red-100">ข้อมูลคอร์สเรียนและประวัติจะหายไปทั้งหมดและกู้คืนไม่ได้</p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" onClick={closeDeleteDialog} disabled={deleting} className="px-4 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-bold hover:bg-gray-50 disabled:opacity-60 transition active:scale-95">
                ยกเลิก
              </button>
              <button type="button" onClick={confirmDelete} disabled={deleting} className="px-4 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-60 transition shadow-lg shadow-red-200 active:scale-95 flex justify-center items-center gap-2">
                {deleting ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div> : null}
                {deleting ? 'กำลังลบ...' : 'ลบถาวร'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}