'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { checkInSchool } from './actions'

let sharedScanner: Html5QrcodeScanner | null = null
let scannerQueue: Promise<void> = Promise.resolve()

async function destroyScanner(scanner: Html5QrcodeScanner | null) {
  if (!scanner) return
  await scanner.clear().catch(() => undefined)
}

function queueScannerTask(task: () => Promise<void>) {
  scannerQueue = scannerQueue.then(task, task)
  return scannerQueue
}

export default function ScanPage() {
  const [scanResult, setScanResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [scannerInitialized, setScannerInitialized] = useState(false)

  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const loadingRef = useRef(false)
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loadingRef.current = loading
  }, [loading])

  function beep(type: 'success' | 'error') {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return

    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    if (type === 'success') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(1000, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      osc.start()
      osc.stop(ctx.currentTime + 0.15)
    } else {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(150, ctx.currentTime)
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    }
  }

  const onScanSuccess = useCallback(async (decodedText: string) => {
    if (loadingRef.current) return
    if (scannerRef.current) scannerRef.current.pause(true)

    setLoading(true)
    setError(null)
    setScanResult(null)

    try {
      const result = await checkInSchool(decodedText)

      if (result.success) {
        setScanResult(result)
        beep('success')
      } else {
        setError(result.message || 'เกิดข้อผิดพลาด')
        beep('error')
      }
    } catch {
      setError('ระบบขัดข้อง กรุณาลองใหม่')
      beep('error')
    } finally {
      setLoading(false)

      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current)
      }

      resumeTimeoutRef.current = setTimeout(() => {
        setScanResult(null)
        setError(null)
        if (scannerRef.current) scannerRef.current.resume()
      }, 3000)
    }
  }, [])

  useEffect(() => {
    let disposed = false

    queueScannerTask(async () => {
      const readerEl = document.getElementById('reader')
      if (!readerEl || disposed) return

      // Force single scanner instance globally to prevent layered UI.
      await destroyScanner(sharedScanner)
      if (disposed) return

      sharedScanner = null
      readerEl.innerHTML = ''

      const scanner = new Html5QrcodeScanner(
        'reader',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
          rememberLastUsedCamera: true,
        },
        false
      )

      scanner.render(onScanSuccess, () => undefined)

      if (disposed) {
        await destroyScanner(scanner)
        return
      }

      sharedScanner = scanner
      scannerRef.current = scanner
      setScannerInitialized(true)
    })

    return () => {
      disposed = true

      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current)
        resumeTimeoutRef.current = null
      }

      queueScannerTask(async () => {
        const activeScanner = scannerRef.current ?? sharedScanner
        scannerRef.current = null
        await destroyScanner(activeScanner)

        if (sharedScanner === activeScanner) {
          sharedScanner = null
        }

        const readerEl = document.getElementById('reader')
        if (readerEl) {
          readerEl.innerHTML = ''
        }
      })
    }
  }, [onScanSuccess])

  return (
    <div className="min-h-screen bg-indigo-900 text-white flex flex-col items-center justify-center p-4 relative">
      <Link
        href="/dashboard"
        className="absolute top-6 left-6 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full text-sm font-bold hover:bg-white/20 transition z-50 flex items-center gap-2"
      >
        <span>🔙</span> กลับเมนู
      </Link>

      <h1 className="text-2xl font-bold mb-6 mt-10 tracking-tight">🏫 จุดเช็กชื่อเข้าโรงเรียน</h1>

      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden p-0 relative min-h-[450px] shadow-2xl border-4 border-indigo-800">
        {(scanResult || error) && (
          <div
            className={`absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center animate-fade-in backdrop-blur-sm ${
              scanResult ? 'bg-green-500/95' : 'bg-red-500/95'
            }`}
          >
            {scanResult ? (
              <div className="text-white">
                <div className="text-7xl mb-4 animate-bounce">👋</div>
                <h2 className="text-3xl font-extrabold mb-1">สวัสดีครับ!</h2>

                {scanResult.student.image_url && (
                  <Image
                    src={scanResult.student.image_url}
                    alt={`รูปนักเรียน ${scanResult.student.name}`}
                    width={96}
                    height={96}
                    unoptimized
                    className="w-24 h-24 rounded-full border-4 border-white mx-auto my-4 object-cover shadow-lg"
                  />
                )}

                <p className="text-2xl font-bold mt-2">{scanResult.student.name}</p>
                <p className="opacity-90 text-lg">({scanResult.student.nickname})</p>

                {scanResult.isRepeat && (
                  <p className="mt-4 bg-black/20 px-3 py-1 rounded-full text-sm">
                    ⚠️ วันนี้เช็กชื่อไปแล้ว
                  </p>
                )}
              </div>
            ) : (
              <div className="text-white">
                <div className="text-7xl mb-4 animate-shake">❌</div>
                <h2 className="text-3xl font-bold mb-2">ไม่พบข้อมูล</h2>
                <p className="text-lg opacity-90">{error}</p>
              </div>
            )}
          </div>
        )}

        {loading && !scanResult && !error && (
          <div className="absolute inset-0 z-20 bg-black/50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
          </div>
        )}

        <div id="reader" className="w-full h-full bg-black"></div>
      </div>

      <p className="mt-8 text-indigo-200 text-sm animate-pulse">
        {scannerInitialized ? 'สแกน QR Code เพื่อเช็กชื่อเข้าโรงเรียน' : 'กำลังเปิดกล้อง...'}
      </p>
    </div>
  )
}
