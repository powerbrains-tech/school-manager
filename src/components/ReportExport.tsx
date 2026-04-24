'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../app/lib/supabase' // ใช้ path ที่เราแก้ขีดแดงไปแล้ว

export default function ReportExport() {
  const [reportType, setReportType] = useState('daily')
  const [isLoading, setIsLoading] = useState(false)
  const [reportData, setReportData] = useState<any[]>([])

  // 1. โหลดข้อมูลอัตโนมัติทุกครั้งที่เปลี่ยนช่วงเวลา (Dropdown)
  useEffect(() => {
    fetchData()
  }, [reportType])

  // 2. ฟังก์ชันคำนวณหาวันที่เริ่มต้น - สิ้นสุด
  const getDateRange = () => {
    const today = new Date()
    const start = new Date(today)
    const end = new Date(today)

    if (reportType === 'daily') {
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
    } else if (reportType === 'weekly') {
      const day = today.getDay() || 7 
      start.setDate(today.getDate() - day + 1)
      start.setHours(0, 0, 0, 0)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)
    } else if (reportType === 'monthly') {
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      end.setMonth(start.getMonth() + 1)
      end.setDate(0) 
      end.setHours(23, 59, 59, 999)
    }

    const formatDate = (date: Date) => {
        const d = new Date(date.getTime() + (7 * 60 * 60 * 1000))
        return d.toISOString().split('T')[0]
    }

    return { startDate: formatDate(start), endDate: formatDate(end) }
  }

  // 3. ดึงข้อมูลจากฐานข้อมูลมาเก็บใน State เพื่อโชว์บนหน้าจอ
  const fetchData = async () => {
    setIsLoading(true)
    try {
      const { startDate, endDate } = getDateRange()

      const { data: schedules, error } = await supabase
        .from('class_schedules')
        .select(`
          id, schedule_date, start_time, end_time,
          subjects (name),
          teachers (name, nickname),
          class_students (id, attendance_status)
        `)
        .gte('schedule_date', startDate)
        .lte('schedule_date', endDate)
        .order('schedule_date', { ascending: true })

      if (error) throw error
      setReportData(schedules || [])
    } catch (error: any) {
      alert(`เกิดข้อผิดพลาด: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 4. ฟังก์ชันโหลด CSV (ดึงจากข้อมูลที่โชว์อยู่บนจอได้เลย ไม่ต้องโหลดใหม่)
  const handleDownloadCSV = () => {
    if (reportData.length === 0) return alert('ไม่มีข้อมูลให้ดาวน์โหลด')

    const headers = ['วันที่', 'เวลา', 'วิชา', 'ครูผู้สอน', 'จำนวนเด็กที่ลงทะเบียน', 'เช็คชื่อแล้ว (คน)']
    const csvRows = [headers.join(',')]

    reportData.forEach((sch: any) => {
      const totalStudents = sch.class_students?.length || 0
      const presentStudents = sch.class_students?.filter((s: any) => s.attendance_status === 'present').length || 0
      
      const dateObj = new Date(sch.schedule_date)
      const formattedDate = dateObj.toLocaleDateString('th-TH')

      const row = [
        `"${formattedDate}"`,
        `"${sch.start_time.substring(0, 5)} - ${sch.end_time.substring(0, 5)}"`,
        `"${sch.subjects?.name || '-'}"`,
        `"${sch.teachers?.nickname || sch.teachers?.name || '-'}"`,
        `"${totalStudents}"`,
        `"${presentStudents}"`
      ]
      csvRows.push(row.join(','))
    })

    const csvContent = csvRows.join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    
    const { startDate, endDate } = getDateRange()
    const fileName = `สรุปคลาสเรียน_${reportType}_${startDate}_ถึง_${endDate}.csv`
    
    link.href = url
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* 1. แถบควบคุม (Controls) */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-4 justify-between">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl shrink-0">📊</div>
          <div>
            <h3 className="font-black text-gray-800 text-lg">รายงานสรุปการสอน</h3>
            <p className="text-xs text-gray-500 mt-0.5">เลือกช่วงเวลาที่ต้องการดูสถิติ</p>
          </div>
        </div>
        
        <div className="flex w-full md:w-auto gap-2">
          <select 
            value={reportType} 
            onChange={(e) => setReportType(e.target.value)}
            className="flex-1 md:w-40 bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-bold cursor-pointer transition-all"
          >
            <option value="daily">สรุปวันนี้</option>
            <option value="weekly">สรุปสัปดาห์นี้</option>
            <option value="monthly">สรุปเดือนนี้</option>
          </select>
          
          <button 
            onClick={handleDownloadCSV}
            disabled={isLoading || reportData.length === 0}
            className="flex-1 md:w-auto bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2 shadow-md text-sm"
          >
            📥 ดาวน์โหลด
          </button>
        </div>
      </div>

      {/* 2. ตารางแสดงข้อมูล (Data Table) */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center">
             <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
             <p className="text-gray-500 font-bold text-sm animate-pulse">กำลังโหลดข้อมูล...</p>
          </div>
        ) : reportData.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-4">
             <span className="text-6xl mb-4 opacity-20">📭</span>
             <h3 className="text-lg font-black text-gray-700">ไม่มีข้อมูลคลาสเรียน</h3>
             <p className="text-sm text-gray-400 mt-1">ไม่พบการเรียนการสอนในช่วงเวลาที่คุณเลือก</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-500 text-[11px] uppercase tracking-wider font-black">
                  <th className="p-4 pl-6 w-16 text-center">ลำดับ</th>
                  <th className="p-4">วันที่ - เวลา</th>
                  <th className="p-4">วิชาที่สอน</th>
                  <th className="p-4">ครูผู้สอน</th>
                  <th className="p-4 text-center">นร. ทั้งหมด</th>
                  <th className="p-4 pr-6 text-center">เช็คชื่อแล้ว</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reportData.map((sch, index) => {
                  const totalStudents = sch.class_students?.length || 0;
                  const presentStudents = sch.class_students?.filter((s: any) => s.attendance_status === 'present').length || 0;
                  const isFullyChecked = totalStudents > 0 && totalStudents === presentStudents;

                  return (
                    <tr key={sch.id} className="hover:bg-indigo-50/30 transition-colors group">
                      <td className="p-4 pl-6 text-center text-sm font-bold text-gray-400 group-hover:text-indigo-400">{index + 1}</td>
                      <td className="p-4">
                        <p className="text-sm font-black text-gray-800">
                          {new Date(sch.schedule_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </p>
                        <p className="text-[10px] text-gray-500 font-bold mt-0.5">
                          {sch.start_time.substring(0, 5)} - {sch.end_time.substring(0, 5)} น.
                        </p>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-bold text-gray-700">{sch.subjects?.name || '-'}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center text-[10px] font-black shrink-0">
                            {sch.teachers?.nickname ? sch.teachers.nickname.charAt(0) : sch.teachers?.name?.charAt(0) || '?'}
                          </div>
                          <span className="text-xs font-bold text-gray-600">{sch.teachers?.name || '-'}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-sm font-black text-gray-800">{totalStudents}</span>
                        <span className="text-[10px] text-gray-400 ml-1">คน</span>
                      </td>
                      <td className="p-4 pr-6 text-center">
                        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-black ${
                          isFullyChecked ? 'bg-green-50 text-green-600 border border-green-100' : 
                          presentStudents > 0 ? 'bg-orange-50 text-orange-600 border border-orange-100' : 
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {presentStudents} / {totalStudents}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}