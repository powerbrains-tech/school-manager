'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { processCheckIn } from './actions'

export default function ClassManagementPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  
  const [schedule, setSchedule] = useState<any>(null)
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [allStudents, setAllStudents] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  const [isEditingClass, setIsEditingClass] = useState(false)
  const [allSubjects, setAllSubjects] = useState<any[]>([])
  const [allTeachers, setAllTeachers] = useState<any[]>([])
  const [allRooms, setAllRooms] = useState<any[]>([])
  const [savingClass, setSavingClass] = useState(false)
  
  const [editForm, setEditForm] = useState({
    subject_id: '',
    teacher_id: '',
    room_id: '',
    start_time: '',
    end_time: ''
  })

  const [resolutionQueue, setResolutionQueue] = useState<any[]>([]) 
  const [selectedResolutions, setSelectedResolutions] = useState<Record<string, string>>({}) 
  const [isProcessingCheckIn, setIsProcessingCheckIn] = useState(false)

  // ✅ ระบบ Toast Notification 
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error' | 'warning'} | null>(null)
  const toastTimeout = useRef<any>(null)

  const showToast = (msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ msg, type })
    if (toastTimeout.current) clearTimeout(toastTimeout.current)
    toastTimeout.current = setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    if (params.id) fetchClassData(params.id)
    fetchEditOptions()
  }, [params.id])

  async function fetchEditOptions() {
    const [subRes, teachRes, roomRes] = await Promise.all([
      supabase.from('subjects').select('id, name').order('name'),
      supabase.from('teachers').select('id, name, nickname').order('name'),
      supabase.from('rooms').select('id, name, capacity').order('name')
    ])
    if (subRes.data) setAllSubjects(subRes.data)
    if (teachRes.data) setAllTeachers(teachRes.data)
    if (roomRes.data) setAllRooms(roomRes.data)
  }

  async function fetchClassData(scheduleId: string) {
    try {
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('class_schedules')
        .select(`
          id, schedule_date, start_time, end_time, status, subject_id, teacher_id, room_id,
          rooms (name, capacity),
          teachers (name, nickname),
          subjects (id, name)
        `)
        .eq('id', scheduleId)
        .single()

      if (scheduleError) throw scheduleError
      setSchedule(scheduleData)

      const { data: studentsData, error: studentsError } = await supabase
        .from('class_students')
        .select(`
          id, attendance_status,
          students (
            id, student_id, name, nickname, image_url, level,
            enrollments ( id, remaining_hours, courses (title) )
          )
        `)
        .eq('schedule_id', scheduleId)

      if (studentsError) throw studentsError
      setEnrolledStudents(studentsData || [])

    } catch (error) {
      console.error('Error fetching class data:', error)
    } finally {
      setLoading(false)
    }
  }

  const openEditMode = () => {
    setEditForm({
      subject_id: schedule.subject_id?.toString() || '',
      teacher_id: schedule.teacher_id?.toString() || '',
      room_id: schedule.room_id?.toString() || '',
      start_time: schedule.start_time.substring(0, 5),
      end_time: schedule.end_time.substring(0, 5)
    })
    setIsEditingClass(true)
  }

  const handleSaveClassInfo = async () => {
    if (!editForm.subject_id || !editForm.teacher_id || !editForm.room_id || !editForm.start_time || !editForm.end_time) {
      return showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'warning')
    }
    
    setSavingClass(true)
    try {
      const { error } = await supabase
        .from('class_schedules')
        .update({
          subject_id: parseInt(editForm.subject_id),
          teacher_id: editForm.teacher_id,
          room_id: editForm.room_id,
          start_time: editForm.start_time,
          end_time: editForm.end_time
        })
        .eq('id', schedule.id)

      if (error) throw error
      
      setIsEditingClass(false)
      fetchClassData(schedule.id) 
      router.refresh() 
      showToast('อัปเดตข้อมูลห้องเรียนสำเร็จ!', 'success')
    } catch (error: any) {
      showToast(`แก้ไขข้อมูลไม่สำเร็จ: ${error.message}`, 'error')
    } finally {
      setSavingClass(false)
    }
  }

  const handleOpenModal = async () => {
    setIsModalOpen(true)
    const { data } = await supabase.from('students').select('id, student_id, name, nickname, image_url, level').order('name')
    setAllStudents(data || [])
  }

  const handleAddStudent = async (studentUuid: string) => {
    if (!schedule) return
    setProcessingId(studentUuid)
    try {
      const { error } = await supabase.from('class_students').insert({
          schedule_id: schedule.id,
          student_id: studentUuid,
          attendance_status: 'pending' 
      })
      if (error) {
        if (error.code === '23505') showToast('นักเรียนคนนี้อยู่ในคลาสนี้แล้ว!', 'warning')
        else throw error
      } else {
        fetchClassData(schedule.id) 
        showToast('เพิ่มนักเรียนเข้าห้องสำเร็จ', 'success')
      }
    } catch (error: any) {
      showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error')
    } finally {
      setProcessingId(null)
    }
  }

  const handleRemoveStudent = async (classStudentId: string) => {
    if (!window.confirm('ยืนยันการนำนักเรียนออกจากคลาสนี้?')) return
    try {
      const { error } = await supabase.from('class_students').delete().eq('id', classStudentId)
      if (error) throw error
      fetchClassData(schedule.id)
      showToast('นำนักเรียนออกจากห้องแล้ว', 'success')
    } catch (error: any) {
      showToast(`ลบไม่สำเร็จ: ${error.message}`, 'error')
    }
  }

  const calculateClassHours = () => {
    if (!schedule || !schedule.start_time || !schedule.end_time) return 1.5
    const [sh, sm] = schedule.start_time.split(':').map(Number)
    const [eh, em] = schedule.end_time.split(':').map(Number)
    let hours = (eh + em/60) - (sh + sm/60)
    if (hours <= 0) hours += 24 
    return Math.round(hours * 10) / 10
  }

  const handleIndividualCheckIn = async (item: any) => {
    const classHours = calculateClassHours()
    const activeEnrollments = item.students?.enrollments?.filter((e: any) => e.remaining_hours >= classHours) || []

    if (activeEnrollments.length === 0) {
      showToast(`${item.students.name} ไม่มีคอร์ส หรือชั่วโมงไม่พอ (${classHours} ชม.)`, 'error')
      return
    }

    if (activeEnrollments.length === 1) {
      if (!window.confirm(`ยืนยันเช็คชื่อและตัด ${classHours} ชม. จากวิชา "${activeEnrollments[0].courses?.title}"?`)) return
      setProcessingId(item.id)
      const res = await processCheckIn(item.id, activeEnrollments[0].id, classHours, schedule.id, schedule.subject_id)
      if (res.success) {
        fetchClassData(schedule.id)
        showToast(`เช็คชื่อ ${item.students.nickname || item.students.name} สำเร็จ!`, 'success')
      } else {
        showToast(`ตัดชั่วโมงไม่สำเร็จ: ${res.error}`, 'error')
      }
      setProcessingId(null)
    } else {
      setResolutionQueue([{ item, enrollments: activeEnrollments }])
      setSelectedResolutions({})
    }
  }

  const handleCheckAll = async () => {
    const pendingStudents = enrolledStudents.filter(s => s.attendance_status === 'pending')
    if (pendingStudents.length === 0) return showToast('นักเรียนทุกคนถูกเช็คชื่อเรียบร้อยแล้ว', 'warning')
    if (!window.confirm('ยืนยันการเช็คชื่อนักเรียนที่เหลือ "ทุกคน"? (ระบบจะตัดชั่วโมงเรียนอัตโนมัติ)')) return

    const classHours = calculateClassHours()
    const multiCourseStudents: any[] = []
    
    setIsProcessingCheckIn(true)
    let successCount = 0

    for (const item of pendingStudents) {
      const activeEnrollments = item.students?.enrollments?.filter((e: any) => e.remaining_hours >= classHours) || []
      
      if (activeEnrollments.length === 1) {
        const res = await processCheckIn(item.id, activeEnrollments[0].id, classHours, schedule.id, schedule.subject_id)
        if (res.success) successCount++
      } else if (activeEnrollments.length > 1) {
        multiCourseStudents.push({ item, enrollments: activeEnrollments })
      }
    }

    setIsProcessingCheckIn(false)
    fetchClassData(schedule.id)

    if (multiCourseStudents.length > 0) {
      setResolutionQueue(multiCourseStudents)
      setSelectedResolutions({})
      if (successCount > 0) {
        showToast(`เช็คชื่ออัตโนมัติ ${successCount} คน เหลือผู้ที่ต้องเลือกคอร์ส`, 'warning')
      }
    } else {
      showToast('เช็คชื่อทุกคนเสร็จสมบูรณ์!', 'success')
    }
  }

  const submitResolutions = async () => {
    for (const q of resolutionQueue) {
      if (!selectedResolutions[q.item.id]) {
        return showToast(`กรุณาเลือกคอร์สให้ "${q.item.students.name}" ให้ครบทุกคนครับ`, 'warning')
      }
    }

    setIsProcessingCheckIn(true)
    const classHours = calculateClassHours()
    let hasError = false

    for (const q of resolutionQueue) {
      const enrollId = selectedResolutions[q.item.id] 
      const res = await processCheckIn(q.item.id, enrollId, classHours, schedule.id, schedule.subject_id)
      
      if (!res.success) {
          showToast(`ตัดชั่วโมงของ "${q.item.students.name}" ไม่สำเร็จ: ${res.error}`, 'error')
          hasError = true
          break
      }
    }

    setIsProcessingCheckIn(false)

    if (!hasError) {
        setResolutionQueue([]) 
        fetchClassData(schedule.id)
        showToast('ตัดชั่วโมงและเช็คชื่อเสร็จสมบูรณ์!', 'success')
    }
  }

  // ✅ ฟังก์ชัน Export ไฟล์ CSV (เพิ่มเข้ามาใหม่)
  const handleExportCSV = () => {
    if (enrolledStudents.length === 0) {
      return showToast('ไม่มีข้อมูลนักเรียนให้ Export', 'warning')
    }

    const headers = ['ลำดับ', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'ชื่อเล่น', 'ระดับชั้น', 'สถานะเช็คชื่อ']
    const csvRows = [headers.join(',')]

    enrolledStudents.forEach((item, index) => {
      const s = item.students
      if (!s) return
      
      const status = item.attendance_status === 'present' ? 'มาเรียน' : 'รอเช็คชื่อ'
      
      const row = [
        index + 1,
        `"${s.student_id || '-'}"`,
        `"${s.name || '-'}"`,
        `"${s.nickname || '-'}"`,
        `"${s.level || '-'}"`,
        `"${status}"`
      ]
      csvRows.push(row.join(','))
    })

    const csvContent = csvRows.join('\n')
    // ใส่ \uFEFF เพื่อให้ Excel แสดงภาษาไทยได้ถูกต้อง
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    
    const subjectName = schedule?.subjects?.name || 'Class'
    const dateStr = new Date(schedule?.schedule_date || new Date()).toLocaleDateString('th-TH').replace(/\//g, '-')
    
    link.href = url
    link.setAttribute('download', `รายชื่อนักเรียน_${subjectName}_${dateStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('ดาวน์โหลดไฟล์ CSV สำเร็จ!', 'success')
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div></div>
  }

  if (!schedule) {
    return <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-gray-500">ไม่พบข้อมูลคลาสเรียนนี้</div>
  }

  const enrolledStudentIds = enrolledStudents.map(es => es.students?.id)
  const availableStudents = allStudents.filter(s => !enrolledStudentIds.includes(s.id))
  const filteredStudents = availableStudents.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.student_id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const capacity = schedule.rooms?.capacity || 20
  const isFull = enrolledStudents.length >= capacity
  const classHours = calculateClassHours()

  return (
    <div className="min-h-screen bg-gray-50 p-3 md:p-8 pb-24 font-sans relative overflow-x-hidden">
      
      {/* 🚀 TOAST NOTIFICATION UI */}
      {toast && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl backdrop-blur-md border animate-fade-in-up flex items-center gap-3 w-[90%] max-w-sm
          ${toast.type === 'success' ? 'bg-green-500/90 border-green-400 text-white' : 
            toast.type === 'error' ? 'bg-red-500/90 border-red-400 text-white' : 
            'bg-orange-500/90 border-orange-400 text-white'}
        `}>
          <span className="text-lg">
            {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : '⚠️'}
          </span>
          <p className="font-bold text-sm tracking-wide">{toast.msg}</p>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition font-bold text-sm mb-4 md:mb-6 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
          <span>🔙</span> <span className="hidden sm:inline">กลับหน้าตารางสอน</span><span className="sm:hidden">กลับ</span>
        </button>

        {/* 1. Header สรุปคลาส */}
        <div className="bg-white rounded-[2rem] p-5 md:p-8 shadow-sm border border-gray-100 mb-6 md:mb-8 relative overflow-hidden group">
            <div className="absolute -right-10 -top-10 text-8xl md:text-9xl opacity-5 pointer-events-none">📚</div>
            
            {!isEditingClass && (
              <button 
                onClick={openEditMode}
                className="absolute top-4 right-4 bg-gray-50 hover:bg-indigo-50 text-gray-500 hover:text-indigo-600 border border-gray-200 px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs font-bold transition shadow-sm active:scale-95 md:opacity-0 md:group-hover:opacity-100 flex items-center gap-1.5 z-20"
              >
                ✏️ <span className="hidden sm:inline">แก้ไขข้อมูลคลาส</span><span className="sm:hidden">แก้ไข</span>
              </button>
            )}

            <div className="relative z-10">
              {isEditingClass ? (
                  <div className="bg-gray-50/80 p-4 md:p-5 rounded-2xl border border-gray-200 w-full animate-fade-in mt-8 md:mt-0">
                      <h3 className="text-sm font-black text-indigo-800 mb-4 flex items-center gap-2">✏️ แก้ไขข้อมูลตารางสอน</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-4">
                          <div>
                              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 mb-1 block">วิชาที่สอน</label>
                              <select 
                                  value={editForm.subject_id} 
                                  onChange={e => setEditForm({...editForm, subject_id: e.target.value})}
                                  className="w-full border-2 border-white focus:border-indigo-300 rounded-xl px-3 py-2 text-sm font-bold text-gray-800 outline-none shadow-sm cursor-pointer"
                              >
                                  <option value="">-- เลือกวิชา --</option>
                                  {allSubjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 mb-1 block">ครูผู้สอน</label>
                              <select 
                                  value={editForm.teacher_id} 
                                  onChange={e => setEditForm({...editForm, teacher_id: e.target.value})}
                                  className="w-full border-2 border-white focus:border-indigo-300 rounded-xl px-3 py-2 text-sm font-bold text-gray-800 outline-none shadow-sm cursor-pointer"
                              >
                                  <option value="">-- เลือกครู --</option>
                                  {allTeachers.map(tch => <option key={tch.id} value={tch.id}>{tch.nickname ? `${tch.name} (${tch.nickname})` : tch.name}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 mb-1 block">ห้องเรียน</label>
                              <select 
                                  value={editForm.room_id} 
                                  onChange={e => setEditForm({...editForm, room_id: e.target.value})}
                                  className="w-full border-2 border-white focus:border-indigo-300 rounded-xl px-3 py-2 text-sm font-bold text-gray-800 outline-none shadow-sm cursor-pointer"
                              >
                                  <option value="">-- เลือกห้อง --</option>
                                  {allRooms.map(rm => <option key={rm.id} value={rm.id}>{rm.name}</option>)}
                              </select>
                          </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
                          <div className="col-span-1">
                              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 mb-1 block">เริ่ม</label>
                              <input 
                                type="time" 
                                value={editForm.start_time} 
                                onChange={e => setEditForm({...editForm, start_time: e.target.value})}
                                className="w-full border-2 border-white focus:border-indigo-300 rounded-xl px-2 py-2 text-sm font-bold text-gray-800 outline-none shadow-sm text-center" 
                              />
                          </div>
                          <div className="col-span-1">
                              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 mb-1 block">สิ้นสุด</label>
                              <input 
                                type="time" 
                                value={editForm.end_time} 
                                onChange={e => setEditForm({...editForm, end_time: e.target.value})}
                                className="w-full border-2 border-white focus:border-indigo-300 rounded-xl px-2 py-2 text-sm font-bold text-gray-800 outline-none shadow-sm text-center" 
                              />
                          </div>
                          <div className="col-span-2 flex flex-col sm:flex-row items-end gap-2 mt-2 sm:mt-0">
                              <button onClick={() => setIsEditingClass(false)} disabled={savingClass} className="w-full sm:flex-1 bg-white border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition active:scale-95 disabled:opacity-50 text-sm shadow-sm">
                                  ยกเลิก
                              </button>
                              <button onClick={handleSaveClassInfo} disabled={savingClass} className="w-full sm:flex-1 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition active:scale-95 disabled:opacity-50 text-sm shadow-md flex justify-center items-center">
                                  {savingClass ? 'บันทึก...' : '💾 บันทึก'}
                              </button>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                      <div>
                          <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2 md:mb-3 mt-6 md:mt-0">
                              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-[10px] md:text-xs font-black tracking-wider uppercase">
                                  {schedule.rooms?.name}
                              </span>
                              <span className="text-xs md:text-sm font-bold text-gray-500 flex items-center gap-1">
                                  📅 {new Date(schedule.schedule_date + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                          </div>
                          <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight mb-2 md:mb-3 leading-tight">
                              {schedule.subjects?.name || 'ไม่ได้ระบุวิชา'}
                          </h1>
                          <p className="text-sm md:text-lg font-bold text-gray-600 flex items-center gap-2">
                              👨‍🏫 ครูผู้สอน: <span className="text-indigo-600">{schedule.teachers?.name} {schedule.teachers?.nickname ? `(${schedule.teachers?.nickname})` : ''}</span>
                          </p>
                      </div>
                      <div className="text-left md:text-right mt-2 md:mt-0 border-t md:border-0 border-gray-100 pt-3 md:pt-0">
                          <p className="text-[10px] md:text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">เวลาเรียน <span className="text-indigo-500 font-black">({classHours} ชม.)</span></p>
                          <p className="text-xl md:text-2xl font-black text-gray-800">
                              {schedule.start_time.substring(0, 5)} - {schedule.end_time.substring(0, 5)} น.
                          </p>
                      </div>
                  </div>
              )}
            </div>
        </div>

        {/* 2. แถบเครื่องมือจัดการนักเรียน */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 md:mb-6 gap-3 md:gap-4">
            <h2 className="text-lg md:text-xl font-black text-gray-800 flex items-center gap-2">
                👥 รายชื่อนักเรียน 
                <span className={`text-xs md:text-sm font-bold px-2 py-0.5 rounded-full ${isFull ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-600'}`}>
                  {enrolledStudents.length} / {capacity}
                </span>
            </h2>
            {/* ✅ ใช้ flex-wrap เพื่อกันปุ่มล้นจอในมือถือ */}
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <button 
                  onClick={handleExportCSV} 
                  disabled={enrolledStudents.length === 0}
                  className="flex-1 sm:flex-none bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-indigo-600 px-3 md:px-4 py-2.5 rounded-xl font-bold shadow-sm transition active:scale-95 text-xs md:text-sm disabled:opacity-50 flex justify-center items-center gap-1.5"
                >
                    📥 <span className="hidden sm:inline">Export (CSV)</span><span className="sm:hidden">โหลด</span>
                </button>
                <button onClick={handleOpenModal} disabled={isFull} className="flex-1 sm:flex-none bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 px-3 md:px-4 py-2.5 rounded-xl font-bold shadow-sm transition active:scale-95 text-xs md:text-sm disabled:opacity-50 flex justify-center items-center gap-1.5">
                    <span>➕</span> {isFull ? 'เต็มแล้ว' : 'เพิ่มเด็ก'}
                </button>
                <button 
                  onClick={handleCheckAll} 
                  disabled={enrolledStudents.filter(s => s.attendance_status === 'pending').length === 0 || isProcessingCheckIn} 
                  className="flex-1 sm:flex-none bg-green-500 text-white px-3 md:px-4 py-2.5 rounded-xl font-bold shadow-sm hover:bg-green-600 transition active:scale-95 text-xs md:text-sm disabled:opacity-50 flex justify-center items-center gap-1.5"
                >
                    {isProcessingCheckIn ? 'รอสักครู่...' : '✅ เช็คชื่อทุกคน'}
                </button>
            </div>
        </div>

        {/* 3. ตารางรายชื่อนักเรียนในห้อง */}
        <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
            {enrolledStudents.length === 0 ? (
                <div className="py-12 md:py-16 flex flex-col items-center justify-center text-center bg-gray-50/50 px-4">
                    <span className="text-5xl md:text-6xl mb-3 md:mb-4 opacity-20">🪑</span>
                    <h3 className="text-base md:text-lg font-bold text-gray-700">ยังไม่มีนักเรียนในคลาสนี้</h3>
                    <p className="text-xs md:text-sm text-gray-400 mt-1">กดปุ่ม "เพิ่มนักเรียน" ด้านบนได้เลย</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-50">
                    {enrolledStudents.map((item, index) => {
                        const student = item.students
                        if (!student) return null
                        const isPresent = item.attendance_status === 'present'

                        return (
                            <div key={item.id} className="p-3 md:p-5 flex items-center justify-between hover:bg-gray-50 transition group">
                                <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                                    <div className="w-5 md:w-8 text-center text-gray-400 font-bold text-xs md:text-base hidden sm:block">{index + 1}</div>
                                    <div className="relative flex-shrink-0">
                                        {student.image_url ? (
                                            <img src={student.image_url} alt={student.name} className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover shadow-sm border border-gray-200" />
                                        ) : (
                                            <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-black text-base md:text-lg shadow-sm border border-indigo-100">
                                                {student.nickname ? student.nickname.charAt(0) : student.name.charAt(0)}
                                            </div>
                                        )}
                                        {isPresent && <span className="absolute -bottom-1 -right-1 w-3 h-3 md:w-4 md:h-4 bg-green-500 border-2 border-white rounded-full"></span>}
                                    </div>
                                    
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-gray-800 flex items-center gap-2 flex-wrap">
                                            <span className="truncate text-sm md:text-base">{student.name} {student.nickname && <span className="text-gray-400">({student.nickname})</span>}</span>
                                            {student.level && (
                                                <span className="text-[9px] md:text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-black border border-blue-100 flex-shrink-0">
                                                    {student.level}
                                                </span>
                                            )}
                                        </p>
                                        <div className="flex items-center gap-1.5 md:gap-2 mt-1 flex-wrap">
                                            <span className="text-[9px] md:text-[10px] text-gray-500 font-mono bg-gray-100 px-1.5 rounded">{student.student_id}</span>
                                            {isPresent ? (
                                                <span className="text-[9px] md:text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded">✅ เช็คชื่อแล้ว</span>
                                            ) : (
                                                <button 
                                                  onClick={() => handleIndividualCheckIn(item)}
                                                  disabled={processingId === item.id}
                                                  className="text-[9px] md:text-[10px] text-orange-600 font-bold bg-orange-50 hover:bg-orange-100 hover:text-orange-700 border border-orange-200 px-2 py-0.5 rounded shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
                                                >
                                                  {processingId === item.id ? 'รอ...' : '✅ กดเช็คชื่อ'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                    <button onClick={() => handleRemoveStudent(item.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition active:scale-95">
                                        ✕
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
      </div>

      {/* ================= MODAL เลือกคอร์ส ================= */}
      {resolutionQueue.length > 0 && (
        <div className="fixed inset-0 z-[60] bg-gray-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up border border-white/20 flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 md:px-6 md:py-5 border-b border-gray-100 bg-orange-50 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-base md:text-lg font-black text-orange-800 flex items-center gap-2">⚠️ มีนักเรียนลงหลายคอร์ส</h2>
                <p className="text-[10px] md:text-xs text-orange-600 font-bold mt-1">กรุณาเลือกคอร์สที่ต้องการตัดชั่วโมง ({classHours} ชม.)</p>
              </div>
            </div>
            
            <div className="overflow-y-auto flex-1 p-3 md:p-4 space-y-3 bg-gray-50">
                {resolutionQueue.map((q) => (
                    <div key={q.item.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold text-xs shrink-0">
                                {q.item.students.nickname ? q.item.students.nickname.charAt(0) : q.item.students.name.charAt(0)}
                            </div>
                            <p className="font-black text-gray-800 text-sm truncate">{q.item.students.name}</p>
                        </div>
                        <select 
                            className="w-full bg-gray-50 border border-gray-300 text-gray-800 text-xs md:text-sm rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 font-bold cursor-pointer"
                            value={selectedResolutions[q.item.id] || ''}
                            onChange={(e) => setSelectedResolutions(prev => ({...prev, [q.item.id]: e.target.value}))}
                        >
                            <option value="">-- เลือกคอร์สที่จะตัดชั่วโมง --</option>
                            {q.enrollments.map((e: any) => (
                                <option key={e.id} value={e.id}>
                                    {e.courses?.title} (เหลือ {e.remaining_hours} ชม.)
                                </option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>

            <div className="p-3 md:p-4 border-t border-gray-100 bg-white flex flex-col sm:flex-row gap-2 md:gap-3 shrink-0">
               <button 
                  onClick={() => setResolutionQueue([])} 
                  className="w-full sm:w-auto px-4 py-2.5 md:py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition active:scale-95 text-sm md:text-base order-2 sm:order-1"
               >
                  ยกเลิก
               </button>
               <button 
                  onClick={submitResolutions} 
                  disabled={isProcessingCheckIn}
                  className="w-full sm:flex-1 bg-indigo-600 text-white px-4 py-2.5 md:py-3 rounded-xl font-black hover:bg-indigo-700 transition active:scale-95 disabled:opacity-50 shadow-md flex justify-center items-center gap-2 text-sm md:text-base order-1 sm:order-2"
               >
                  {isProcessingCheckIn ? 'กำลังประมวลผล...' : '💾 ยืนยันการตัดชั่วโมง'}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL ค้นหาและเพิ่มนักเรียน ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up border border-white/20 flex flex-col max-h-[85vh]">
            
            <div className="px-5 py-4 md:px-6 md:py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 shrink-0">
              <h2 className="text-base md:text-lg font-black text-gray-800 flex items-center gap-2">🔍 เลือกนักเรียนเข้าห้อง</h2>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 hover:bg-gray-100 text-gray-500 font-bold transition shadow-sm active:scale-95 shrink-0">✕</button>
            </div>
            
            <div className="p-3 md:p-4 border-b border-gray-100 shrink-0">
                <input 
                    type="text" 
                    placeholder="ค้นหาจากชื่อ หรือ รหัส..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-sm"
                />
            </div>

            <div className="overflow-y-auto flex-1 p-2">
                {filteredStudents.length === 0 ? (
                    <div className="py-10 text-center text-gray-400 text-sm font-medium">ไม่พบรายชื่อนักเรียน</div>
                ) : (
                    <div className="space-y-1">
                        {filteredStudents.map(student => (
                            <div key={student.id} className="flex items-center justify-between p-2 md:p-3 rounded-xl hover:bg-gray-50 transition min-w-0">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold text-xs md:text-sm shrink-0">
                                        {student.nickname ? student.nickname.charAt(0) : student.name.charAt(0)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-gray-800 text-xs md:text-sm flex items-center gap-1.5 flex-wrap truncate">
                                            <span className="truncate">{student.name}</span>
                                            {student.level && <span className="text-[8px] md:text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-black border border-blue-100 shrink-0">{student.level}</span>}
                                        </p>
                                        <p className="text-[9px] md:text-[10px] text-gray-500 font-mono mt-0.5">{student.student_id}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleAddStudent(student.id)}
                                    disabled={processingId === student.id}
                                    className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-[10px] md:text-xs font-bold transition active:scale-95 disabled:opacity-50 shrink-0 ml-2"
                                >
                                    {processingId === student.id ? 'กำลังเพิ่ม...' : '+ เพิ่ม'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}