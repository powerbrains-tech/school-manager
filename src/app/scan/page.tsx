// src/app/scan/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { recordAttendance } from '../register/actions' // ตรวจสอบ path ให้ถูกนะครับ

export default function ScanPage() {
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    // ตั้งค่าตัวสแกน QR Code
    const scanner = new Html5QrcodeScanner(
  "reader",
  { 
    fps: 10, 
    qrbox: { width: 250, height: 250 },
    rememberLastUsedCamera: true // จำกล้องล่าสุดที่ใช้
  },
  false
)

    scanner.render(onScanSuccess, (error) => {
      // console.warn(error) // ซ่อน error log ที่ไม่จำเป็น
    })

    async function onScanSuccess(decodedText: string) {
      // ถ้ากำลังประมวลผลอยู่ หรือสแกนซ้ำเบอร์เดิม ให้ข้ามไป
      if (isProcessing) return 
      
      scanner.pause(true) // หยุดกล้องชั่วคราวระหว่างประมวลผล
      setIsProcessing(true)
      setScanResult(decodedText)

      try {
        // เรียก Server Action เพื่อตัดแต้ม
        const result = await recordAttendance(decodedText)
        
        if (result.success) {
          setMessage(`✅ เช็คชื่อสำเร็จ! \nน้อง ${result.studentName} \nเหลือ ${result.remaining} ชม.`)
        } else {
          setMessage(`❌ เกิดข้อผิดพลาด: ${result.message}`)
        }
      } catch (error) {
        setMessage('❌ ระบบขัดข้อง กรุณาลองใหม่')
      }

      setIsProcessing(false)
      
      // หน่วงเวลา 3 วินาทีก่อนเริ่มสแกนคนต่อไป
      setTimeout(() => {
        setScanResult(null)
        setMessage('')
        scanner.resume() 
      }, 3000)
    }

    return () => {
      scanner.clear().catch(error => console.error("Failed to clear html5-qrcode scanner. ", error));
    }
  }, []) // run ครั้งเดียวตอนเปิดหน้า

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-6">📷 จุดสแกนเข้าเรียน</h1>
      
      {/* พื้นที่กล้อง */}
      <div id="reader" className="w-full max-w-sm bg-white rounded-lg overflow-hidden text-black"></div>

      {/* ผลลัพธ์ */}
      {scanResult && (
        <div className={`mt-6 p-6 rounded-xl text-center w-full max-w-sm ${message.includes('✅') ? 'bg-green-600' : 'bg-red-600'}`}>
          <p className="text-xl font-bold whitespace-pre-line leading-relaxed">{message}</p>
        </div>
      )}

      {!scanResult && (
        <p className="mt-8 text-gray-400 animate-pulse">กำลังรอกล้อง...</p>
      )}
    </div>
  )
}