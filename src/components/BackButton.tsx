'use client'

import { useRouter } from 'next/navigation'

export default function BackButton() {
  const router = useRouter()

  return (
    <button 
      onClick={() => router.back()} 
      className="text-gray-500 hover:text-indigo-600 transition flex items-center gap-2 mb-6 text-sm font-medium cursor-pointer bg-transparent border-none p-0"
    >
      <span>🔙</span> กลับหน้าก่อนหน้า
    </button>
  )
}