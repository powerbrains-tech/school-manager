'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import Link from 'next/link'
import { getScheduleOptions, createSchedule } from './actions'

// --- Types ---
type Schedule = {
  id: string
  start_time: string
  end_time: string
  status: string
  rooms: { name: string; capacity: number } | null
  teachers: { name: string; nickname: string | null } | null
  subjects: { name: string } | null // ✅ เปลี่ยนจาก courses เป็น subjects
  student_count: number
}

type FormOptions = {
  rooms: any[]
  teachers: any[]
  subjects: any[] // ✅ เปลี่ยนเป็น subjects
}

export default function TimetablePage() {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  
  // State สำหรับ Modal Pop-up
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formOptions, setFormOptions] = useState<FormOptions>({ rooms: [], teachers: [], subjects: [] }) // ✅ อัปเดต state
  const [saving, setSaving] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  
  const dateInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchSchedules(currentDate)
  }, [currentDate])

  async function fetchSchedules(date: Date) {
    setLoading(true)
    const offset = date.getTimezoneOffset()
    const localDate = new Date(date.getTime() - (offset*60*1000))
    const dateString = localDate.toISOString().split('T')[0]

    try {
      const { data, error } = await supabase
        .from('class_schedules')
        .select(`
          id, start_time, end_time, status,
          rooms (name, capacity),
          teachers (name, nickname),
          subjects (name), 
          class_students (count)
        `) // ✅ สั่งดึง subjects(name) มาแสดงผล
        .eq('schedule_date', dateString)
        .order('start_time', { ascending: true })

      if (error) throw error

      const formattedData = (data as any[]).map(item => ({
        ...item,
        student_count: item.class_students?.[0]?.count || 0
      }))

      setSchedules(formattedData)
    } catch (error) {
      console.error('Error fetching schedules:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = async () => {
    setIsModalOpen(true)
    const options = await getScheduleOptions()
    setFormOptions({
      rooms: options.rooms || [],
      teachers: options.teachers || [],
      subjects: options.subjects || [] // ✅ รับค่า subjects จาก actions
    })
  }

  const handleSaveSchedule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    
    const result = await createSchedule(formData)
    
    if (result.success) {
      setIsModalOpen(false)
      formRef.current?.reset()
      fetchSchedules(currentDate) 
      alert('บันทึกตารางสอนสำเร็จ!')
    } else {
      alert(`เกิดข้อผิดพลาด: ${result.error}`)
    }
    setSaving(false)
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setCurrentDate(new Date(e.target.value))
    }
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const isToday = 
    currentDate.getDate() === new Date().getDate() &&
    currentDate.getMonth() === new Date().getMonth() &&
    currentDate.getFullYear() === new Date().getFullYear()

  const offset = currentDate.getTimezoneOffset()
  const localDateStr = new Date(currentDate.getTime() - (offset*60*1000)).toISOString().split('T')[0]

  const groupedSchedules = schedules.reduce((acc, curr) => {
    const time = curr.start_time.substring(0, 5)
    if (!acc[time]) acc[time] = []
    acc[time].push(curr)
    return acc
  }, {} as Record<string, Schedule[]>)

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 pb-20 font-sans">
      <div className="max-w-5xl mx-auto">
        
        <div className="mb-8">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition font-bold text-sm mb-4 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
            <span>🔙</span> กลับหน้าหลัก
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                 🗓️ ตารางสอนประจำวัน
              </h1>
              <p className="text-gray-500 mt-1 font-medium">จัดการห้องเรียนและเช็คชื่อนักเรียนตามรอบ</p>
            </div>

            <div className="flex flex-col items-end gap-2">
                {!isToday && (
                    <button onClick={goToToday} className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-3 py-1 rounded-full uppercase tracking-wider hover:bg-indigo-200 transition active:scale-95">
                        กลับมาวันนี้
                    </button>
                )}
                
                <div 
                  onClick={() => {
                    try {
                      if (dateInputRef.current && typeof dateInputRef.current.showPicker === 'function') {
                        dateInputRef.current.showPicker();
                      } else {
                        dateInputRef.current?.focus(); 
                      }
                    } catch (error) {
                      console.error(error)
                    }
                  }}
                  className="relative cursor-pointer flex items-center gap-4 bg-white px-5 py-2.5 rounded-2xl shadow-sm border border-gray-200 hover:border-indigo-300 transition-colors group"
                >
                    <input 
                      type="date" 
                      ref={dateInputRef}
                      value={localDateStr}
                      onChange={handleDateChange}
                      className="absolute inset-0 w-full h-full opacity-0 pointer-events-none -z-10"
                    />
                    
                    <div className="text-right">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                            {isToday ? `วันนี้ • ${currentDate.toLocaleDateString('th-TH', { weekday: 'long' })}` : currentDate.toLocaleDateString('th-TH', { weekday: 'long' })}
                        </p>
                        <p className={`text-lg leading-tight font-black ${isToday ? 'text-indigo-600' : 'text-gray-800'}`}>
                            {currentDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                    </div>
                    
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform">
                        📅
                    </div>
                </div>
            </div>
          </div>
        </div>

        <div className="mb-8 flex justify-end">
           <button onClick={handleOpenModal} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95">
             <span>➕</span> เพิ่มตารางสอนใหม่
           </button>
        </div>

        {loading ? (
           <div className="flex flex-col items-center justify-center py-20">
             <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
             <p className="text-gray-400 font-bold tracking-wider">กำลังโหลดตารางสอน...</p>
           </div>
        ) : schedules.length === 0 ? (
           <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 py-20 flex flex-col items-center justify-center text-center shadow-sm">
             <span className="text-6xl mb-4 opacity-30">📭</span>
             <h3 className="text-xl font-black text-gray-700">ไม่มีรอบเรียนในวันนี้</h3>
             <p className="text-gray-400 mt-2 font-medium">ลองเปลี่ยนวันที่ หรือกดปุ่มเพิ่มตารางสอนใหม่ได้เลย</p>
           </div>
        ) : (
           <div className="space-y-8">
             {Object.entries(groupedSchedules).map(([time, classes]) => (
               <div key={time} className="relative">
                 <div className="flex items-center gap-4 mb-4">
                    <div className="bg-gray-800 text-white px-4 py-1.5 rounded-full font-black tracking-widest text-sm shadow-md">
                       เวลา {time} น.
                    </div>
                    <div className="h-px bg-gray-200 flex-1"></div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-2 md:pl-6">
                   {classes.map((cls) => {
                      const capacity = cls.rooms?.capacity || 20
                      const isFull = cls.student_count >= capacity
                      const percent = Math.min(100, (cls.student_count / capacity) * 100)

                      return (
                       <div key={cls.id} className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all group relative overflow-hidden flex flex-col h-full">
                         <div className="absolute top-4 right-4 bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-xs font-black border border-indigo-100 z-10">
                           🚪 {cls.rooms?.name || 'ไม่ระบุห้อง'}
                         </div>
                         
                         {/* ✅ เปลี่ยนให้โชว์ชื่อวิชาแทน */}
                         <h3 className="text-lg font-black text-gray-900 mt-1 mb-1 pr-16 group-hover:text-indigo-600 transition-colors truncate">
                           {cls.subjects?.name || 'ไม่ได้ระบุวิชา'}
                         </h3>
                         
                         <p className="text-sm font-bold text-gray-500 flex items-center gap-1.5 mb-4">
                           👨‍🏫 ครู{cls.teachers?.nickname || cls.teachers?.name || 'ไม่ระบุ'}
                         </p>
                         
                         <div className="mt-auto">
                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 mb-4">
                               <div className="flex justify-between items-end mb-2">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">จำนวนนักเรียน</span>
                                  <span className={`text-sm font-black ${isFull ? 'text-red-500' : 'text-gray-700'}`}>
                                    {cls.student_count} / {capacity}
                                  </span>
                               </div>
                               <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                  <div className={`h-full rounded-full transition-all duration-1000 ${isFull ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${percent}%` }}></div>
                               </div>
                            </div>
                            
                            <button 
                               onClick={() => router.push(`/timetable/${cls.id}`)}
                               className="w-full bg-gray-900 text-white font-bold py-2.5 rounded-xl hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2 text-sm shadow-sm active:scale-95"
                            >
                               📋 จัดการ / เช็คชื่อ
                            </button>
                         </div>
                       </div>
                     )
                   })}
                 </div>
               </div>
             ))}
           </div>
        )}
      </div>

      {/* ================= MODAL เพิ่มตารางสอน ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up border border-white/20">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">📝 สร้างตารางสอนใหม่</h2>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 hover:bg-gray-100 text-gray-500 font-bold transition shadow-sm active:scale-95">✕</button>
            </div>
            
            <form ref={formRef} onSubmit={handleSaveSchedule} className="p-6 space-y-4">
              
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase ml-2 mb-1 block">วันที่สอน</label>
                <input type="date" name="schedule_date" required defaultValue={localDateStr} className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-bold text-gray-700 bg-gray-50 hover:bg-white transition-colors" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase ml-2 mb-1 block">เวลาเริ่ม</label>
                  <input type="time" name="start_time" required defaultValue="09:00" className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-bold text-gray-700 bg-gray-50 hover:bg-white transition-colors" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase ml-2 mb-1 block">เวลาสิ้นสุด</label>
                  <input type="time" name="end_time" required defaultValue="10:30" className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-bold text-gray-700 bg-gray-50 hover:bg-white transition-colors" />
                </div>
              </div>

              {/* ✅ เปลี่ยนเป็นเลือกวิชา */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase ml-2 mb-1 block">วิชาที่สอน</label>
                <select name="subject_id" required className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-bold text-gray-700 appearance-none bg-gray-50 hover:bg-white transition-colors cursor-pointer">
                  <option value="">-- เลือกวิชา --</option>
                  {formOptions.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase ml-2 mb-1 block">ครูผู้สอน</label>
                  <select name="teacher_id" required className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-bold text-gray-700 appearance-none bg-gray-50 hover:bg-white transition-colors cursor-pointer">
                    <option value="">-- เลือกครู --</option>
                    {formOptions.teachers.map(t => <option key={t.id} value={t.id}>{t.nickname ? `${t.name} (${t.nickname})` : t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase ml-2 mb-1 block">ห้องเรียน</label>
                  <select name="room_id" required className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-bold text-gray-700 appearance-none bg-gray-50 hover:bg-white transition-colors cursor-pointer">
                    <option value="">-- เลือกห้อง --</option>
                    {formOptions.rooms.map(r => <option key={r.id} value={r.id}>{r.name} (จุ {r.capacity} คน)</option>)}
                  </select>
                </div>
              </div>

              <button type="submit" disabled={saving} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition active:scale-95 disabled:opacity-50 mt-6 flex justify-center items-center gap-2">
                {saving ? (
                    <><div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div> กำลังบันทึก...</>
                ) : '💾 บันทึกตารางสอน'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}