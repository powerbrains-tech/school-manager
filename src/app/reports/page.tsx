'use client'

import { useRouter } from 'next/navigation'
import ReportExport from '../../components/ReportExport'

export default function ReportsPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* ปุ่มกดย้อนกลับ */}
        <button 
          onClick={() => router.push('/dashboard')} // หรือเปลี่ยนเป็นหน้าหลักที่คุณต้องการ
          className="inline-flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition font-bold text-sm mb-6 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100"
        >
          <span>🔙</span> กลับหน้าหลัก
        </button>

        {/* Header ของหน้ารายงาน */}
        <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-gray-100 mb-8 relative overflow-hidden">
            <div className="absolute -right-10 -top-10 text-8xl md:text-9xl opacity-5 pointer-events-none">📈</div>
            <h1 className="text-2xl md:text-4xl font-black text-gray-900 mb-2">ระบบรายงานผล</h1>
            <p className="text-gray-500 font-bold text-sm md:text-base">
              ดาวน์โหลดสรุปข้อมูลการสอน จำนวนนักเรียน และการเช็คชื่อเข้าเรียน
            </p>
        </div>

        {/* ดึง Component สรุปรายงานมาแสดงตรงนี้ */}
        <div className="grid grid-cols-1 gap-6">
            <ReportExport />
            
            {/* ในอนาคตถ้ามีรายงานแบบอื่นๆ เช่น รายงานการเงิน สามารถเอามาเพิ่มต่อตรงนี้ได้เลยครับ */}
            {/* <FinancialReport /> */}
        </div>

      </div>
    </div>
  )
}