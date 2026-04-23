'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'
import { addTeacher, deleteTeacher, updateTeacher } from './actions'

type Teacher = {
  id: string
  name: string
  nickname: string | null
  created_at: string
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // State สำหรับหน้าต่างแก้ไข
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchTeachers()
  }, [])

  async function fetchTeachers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('teachers')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setTeachers(data)
    }
    setLoading(false)
  }

  const handleAddTeacher = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    
    const result = await addTeacher(formData)
    if (result.success) {
      formRef.current?.reset()
      fetchTeachers() // โหลดข้อมูลใหม่
    } else {
      alert(`เกิดข้อผิดพลาด: ${result.error}`)
    }
    setSaving(false)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`คุณแน่ใจหรือไม่ที่จะลบ "ครู${name}" ออกจากระบบ?`)) return

    const result = await deleteTeacher(id)
    if (result.success) {
      fetchTeachers()
    } else {
      alert(result.error)
    }
  }

  const handleUpdateTeacher = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setUpdating(true)
    const formData = new FormData(e.currentTarget)
    
    const result = await updateTeacher(formData)
    if (result.success) {
      setEditingTeacher(null) // ปิด Modal
      fetchTeachers() // โหลดข้อมูลใหม่
    } else {
      alert(`เกิดข้อผิดพลาด: ${result.error}`)
    }
    setUpdating(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 pb-20 font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition font-bold text-sm mb-4 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
            <span>🔙</span> กลับหน้าหลัก
          </Link>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
             👨‍🏫 จัดการข้อมูลคุณครู
          </h1>
          <p className="text-gray-500 mt-1 font-medium">เพิ่ม ลบ หรือแก้ไขรายชื่อคุณครูในระบบ</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* ฟอร์มเพิ่มครู (ด้านซ้าย) */}
            <div className="md:col-span-1">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 sticky top-8">
                    <h2 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                        ✨ เพิ่มคุณครูใหม่
                    </h2>
                    <form ref={formRef} onSubmit={handleAddTeacher} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">ชื่อจริง - นามสกุล *</label>
                            <input 
                                type="text" 
                                name="name" 
                                required 
                                placeholder="เช่น สมชาย ใจดี"
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-sm text-gray-800"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">ชื่อเล่น (ถ้ามี)</label>
                            <input 
                                type="text" 
                                name="nickname" 
                                placeholder="เช่น บอย"
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-sm text-gray-800"
                            />
                        </div>
                        <button type="submit" disabled={saving} className="w-full bg-indigo-600 text-white font-black py-3.5 rounded-xl shadow-md hover:bg-indigo-700 transition active:scale-95 disabled:opacity-50 mt-2 flex justify-center items-center gap-2">
                            {saving ? 'กำลังบันทึก...' : '💾 บันทึกข้อมูล'}
                        </button>
                    </form>
                </div>
            </div>

            {/* รายชื่อครู (ด้านขวา) */}
            <div className="md:col-span-2">
                <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                    <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h3 className="font-black text-gray-800">📋 รายชื่อคุณครูทั้งหมด ({teachers.length})</h3>
                    </div>
                    
                    {loading ? (
                        <div className="py-16 text-center text-gray-400 font-medium">กำลังโหลดข้อมูล...</div>
                    ) : teachers.length === 0 ? (
                        <div className="py-16 text-center text-gray-400 font-medium">ยังไม่มีรายชื่อคุณครูในระบบ</div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {teachers.map((teacher) => (
                                <div key={teacher.id} className="p-5 flex items-center justify-between hover:bg-gray-50 transition group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner border border-indigo-100">
                                            {teacher.nickname ? teacher.nickname.charAt(0) : teacher.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-black text-gray-800 text-base">
                                                ครู{teacher.name} {teacher.nickname && <span className="text-gray-400 font-medium ml-1">({teacher.nickname})</span>}
                                            </p>
                                            <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                                                เพิ่มเมื่อ: {new Date(teacher.created_at).toLocaleDateString('th-TH')}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                        {/* ปุ่มแก้ไข */}
                                        <button 
                                            onClick={() => setEditingTeacher(teacher)}
                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition border border-transparent hover:border-indigo-100 active:scale-95 bg-white md:bg-transparent shadow-sm md:shadow-none"
                                            title="แก้ไขข้อมูล"
                                        >
                                            ✏️
                                        </button>
                                        {/* ปุ่มลบ */}
                                        <button 
                                            onClick={() => handleDelete(teacher.id, teacher.nickname || teacher.name)}
                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition border border-transparent hover:border-red-100 active:scale-95 bg-white md:bg-transparent shadow-sm md:shadow-none"
                                            title="ลบข้อมูล"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

        </div>
      </div>

      {/* ================= MODAL แก้ไขข้อมูลครู ================= */}
      {editingTeacher && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-slide-up border border-white/20">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">✏️ แก้ไขข้อมูลคุณครู</h2>
              <button onClick={() => setEditingTeacher(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 hover:bg-gray-100 text-gray-500 font-bold transition shadow-sm active:scale-95">✕</button>
            </div>
            
            <form onSubmit={handleUpdateTeacher} className="p-6 space-y-4">
              <input type="hidden" name="id" value={editingTeacher.id} />
              
              <div>
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">ชื่อจริง - นามสกุล *</label>
                  <input 
                      type="text" 
                      name="name" 
                      required 
                      defaultValue={editingTeacher.name}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-sm text-gray-800"
                  />
              </div>
              <div>
                  <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">ชื่อเล่น (ถ้ามี)</label>
                  <input 
                      type="text" 
                      name="nickname" 
                      defaultValue={editingTeacher.nickname || ''}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-sm text-gray-800"
                  />
              </div>

              <div className="pt-2 flex gap-3">
                  <button type="button" onClick={() => setEditingTeacher(null)} disabled={updating} className="flex-1 bg-white border-2 border-gray-200 text-gray-600 font-bold py-3.5 rounded-xl hover:bg-gray-50 transition active:scale-95 disabled:opacity-50">
                      ยกเลิก
                  </button>
                  <button type="submit" disabled={updating} className="flex-1 bg-indigo-600 text-white font-black py-3.5 rounded-xl shadow-md hover:bg-indigo-700 transition active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2">
                      {updating ? 'กำลังบันทึก...' : '💾 บันทึก'}
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}