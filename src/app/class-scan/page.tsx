'use client'

import { useState, useEffect } from 'react'
import { useZxing } from 'react-zxing'
import { getAllSubjects, getStudentTimeBank, deductTimeBank } from './actions'
import Link from 'next/link'
import Image from 'next/image'

export default function ClassScanPage() {
  const [subjects, setSubjects] = useState<any[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string>('') 
  const [lastScanned, setLastScanned] = useState<any>(null)
  const [message, setMessage] = useState<string | null>(null)
  
  const [isPaused, setIsPaused] = useState(false)

  // 1. โหลดรายชื่อวิชา
  useEffect(() => {
    async function loadSubjects() {
        const data = await getAllSubjects()
        setSubjects(data)
        if(data && data.length > 0) setSelectedSubject(String(data[0].id))
    }
    loadSubjects()
  }, [])

  // 🔊 Sound Effect
  function beep(type: 'success' | 'error') {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    
    if (type === 'success') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(1000, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.15);
    } else {
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.3);
    }
  }

  // 🔥 Logic การสแกน
  const { ref } = useZxing({
    // ✅ ใช้ onResult แทน onDecodeResult
    onResult(result) {
      handleScan(result.getText())
    },
    onError() {
       // ignore errors
    }
  });

  async function handleScan(decodedText: string) {
    if (!selectedSubject || isPaused) return

    setIsPaused(true) // ⏸️ หยุดรับค่าซ้ำ
    setMessage(null)

    try {
        const checkResult = await getStudentTimeBank(decodedText) as any
        
        if (!checkResult.success) {
            setMessage(`❌ ${checkResult.message}`)
            beep('error')
        } else {
            const { student, enrollment } = checkResult
            
            const deductResult = await deductTimeBank(
                enrollment.id, 
                enrollment.remaining_hours, 
                parseInt(selectedSubject) 
            )

            if (deductResult.success) {
                const packageName = (enrollment.courses as any)?.title || 'แพ็กเกจเวลา'
                setLastScanned({
                    name: student.name,
                    nickname: student.nickname,
                    image_url: student.image_url,
                    remaining: deductResult.remaining,
                    packageName: packageName
                })
                beep('success')
            } else {
                setMessage(`❌ ตัดเวลาไม่สำเร็จ: ${deductResult.message}`)
                beep('error')
            }
        }
    } catch (e) {
        console.error(e)
        setMessage('Error: ระบบขัดข้อง')
        beep('error')
    } finally {
        setTimeout(() => {
            setIsPaused(false) // ▶️ เริ่มใหม่
        }, 2500)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 relative">
        <Link href="/dashboard" className="absolute top-6 left-6 bg-white/10 px-4 py-2 rounded-full text-sm hover:bg-white/20 z-50 transition flex items-center gap-2">
            <span>🔙</span> กลับเมนู
        </Link>

        <h1 className="text-xl font-bold mb-2 mt-16 text-orange-400 flex items-center gap-2">
            ✂️ ตัดชั่วโมงเรียน <span className="text-xs bg-orange-900/50 px-2 py-1 rounded text-orange-200">Pro Engine</span>
        </h1>

        {/* เลือกวิชา */}
        <div className="w-full max-w-md mb-4 z-10">
            <div className="relative">
                <select 
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full p-4 pr-10 rounded-2xl bg-gray-800 border border-gray-700 text-white text-lg font-bold focus:ring-2 focus:ring-orange-500 outline-none appearance-none shadow-lg"
                >
                    {subjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>📚 {sub.name}</option>
                    ))}
                    {subjects.length === 0 && <option>กำลังโหลดวิชา...</option>}
                </select>
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">🔻</div>
            </div>
        </div>

        {/* พื้นที่กล้อง */}
        <div className="w-full max-w-md bg-black rounded-3xl overflow-hidden border-4 border-orange-500 relative min-h-[400px] shadow-2xl flex items-center justify-center">
            
            {/* 🎥 กล้อง */}
            <video ref={ref} className="absolute inset-0 w-full h-full object-cover" />

            {/* Overlay ผลลัพธ์ */}
            {lastScanned && isPaused && !message && (
                <div className="absolute inset-0 z-20 bg-green-600/95 flex flex-col items-center justify-center p-6 text-center animate-fade-in backdrop-blur-sm">
                    <div className="text-6xl mb-2 animate-bounce">✅</div>
                    
                    {lastScanned.image_url && (
                        <Image
                          src={lastScanned.image_url}
                          alt={`รูปนักเรียน ${lastScanned.name}`}
                          width={96}
                          height={96}
                          unoptimized
                          className="w-24 h-24 rounded-full border-4 border-white mb-2 object-cover shadow-lg"
                        />
                    )}

                    <h2 className="text-2xl font-bold text-white leading-tight">{lastScanned.name}</h2>
                    <p className="text-green-100 text-lg mb-4">({lastScanned.nickname})</p>
                    
                    <div className="bg-white/20 p-4 rounded-2xl w-full border border-white/20 backdrop-blur-md">
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-xs uppercase tracking-wider opacity-80">ตัดเวลา</span>
                            <span className="text-xl font-bold text-red-200">-1.5 ชม.</span>
                        </div>
                        <div className="h-px bg-white/20 w-full mb-2"></div>
                        <p className="text-xs uppercase tracking-wider opacity-80 text-left">คงเหลือ</p>
                        <p className="text-5xl font-black text-white text-left">{lastScanned.remaining} <span className="text-lg font-normal">ชม.</span></p>
                    </div>
                </div>
            )}

            {/* Error Message */}
            {message && isPaused && (
                <div className="absolute inset-0 z-20 bg-red-600/95 flex flex-col items-center justify-center p-6 text-center animate-fade-in backdrop-blur-sm">
                    <div className="text-7xl mb-4 animate-shake">❌</div>
                    <h2 className="text-2xl font-bold mb-2">ผิดพลาด</h2>
                    <p className="text-lg opacity-90 font-medium">{message}</p>
                    <button 
                        onClick={() => setIsPaused(false)}
                        className="mt-6 px-6 py-2 bg-white text-red-600 rounded-full font-bold hover:bg-red-50 transition"
                    >
                        สแกนใหม่
                    </button>
                </div>
            )}
            
            {/* Guide Text */}
            {!isPaused && (
                <div className="absolute bottom-6 bg-black/50 px-4 py-2 rounded-full text-sm text-white/80 backdrop-blur-md pointer-events-none">
                    วาง QR Code ให้อยู่กลางจอ
                </div>
            )}
        </div>
    </div>
  )
}
