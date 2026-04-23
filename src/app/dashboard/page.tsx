import { supabase } from '../lib/supabase'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import LogoutButton from '@/components/LogoutButton'
import { isUserRole, type UserRole } from '../lib/rbac'

// --- Helper Functions ---
function getRoleLabel(role: string) {
  const labels: Record<string, string> = {
    admin: 'ผู้ดูแลระบบสูงสุด',
    teacher: 'คุณครูประจำวิชา',
    staff: 'เจ้าหน้าที่ธุรการ'
  }
  return labels[role] || 'ผู้ใช้งานทั่วไป'
}

function timeAgo(dateString: string) {
  const now = new Date();
  const past = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) return 'เมื่อสักครู่';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} นาทีที่แล้ว`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ชม. ที่แล้ว`;
  return past.toLocaleDateString('th-TH');
}

// --- Server Data Fetching ---
async function getDashboardStats() {
  const { count: studentCount } = await supabase.from('students').select('*', { count: 'exact', head: true })
  const { count: courseCount } = await supabase.from('courses').select('*', { count: 'exact', head: true })

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0) 
  
  const { data: todayCheckins, count: todayCheckinCount } = await supabase
    .from('daily_checkins')
    .select(`
        id,
        students (level) 
    `, { count: 'exact' })
    .gte('created_at', todayStart.toISOString())

  const levelStats: Record<string, number> = {};
  todayCheckins?.forEach((log: any) => {
      const level = log.students?.level || 'ไม่ระบุ';
      levelStats[level] = (levelStats[level] || 0) + 1;
  });

  const levelSummary = Object.entries(levelStats)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const { data: recentLogs } = await supabase
    .from('daily_checkins')
    .select(`id, created_at, students (name, nickname, image_url, level, student_id)`)
    .order('created_at', { ascending: false })
    .limit(5)

  return { 
      studentCount: studentCount || 0, 
      courseCount: courseCount || 0, 
      todayCheckinCount: todayCheckinCount || 0, 
      recentLogs: recentLogs || [],
      levelSummary
  }
}

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('admin_session')
  
  if (!sessionCookie) redirect('/login')

  let user = { name: 'ผู้ใช้งาน', role: 'staff' as UserRole }
  try {
    const parsed = JSON.parse(sessionCookie.value)
    user = {
      name: parsed.name || 'ผู้ใช้งาน',
      role: isUserRole(parsed.role) ? parsed.role : 'staff'
    }
  } catch (e) {
    console.error("Invalid session cookie")
  }

  const stats = await getDashboardStats()
  const isAdmin = user.role === 'admin'

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-6 pb-20 font-sans selection:bg-indigo-100">
      
      {/* Header Section */}
      <div className="max-w-6xl mx-auto mb-10 mt-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="animate-fade-in-up">
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 flex items-center gap-3 tracking-tight">
            👋 สวัสดีครับ, {user.name}
          </h1>
          <div className="flex items-center gap-3 mt-3">
             <span className={`px-3 py-1.5 rounded-lg text-xs font-black border uppercase tracking-widest shadow-sm ${
                isAdmin ? 'bg-red-50 text-red-600 border-red-200' :
                user.role === 'teacher' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                'bg-blue-50 text-blue-600 border-blue-200'
             }`}>
                {getRoleLabel(user.role)}
             </span>
             <p className="text-gray-500 text-sm font-medium">| สถิติและภาพรวมระบบวันนี้</p>
          </div>
        </div>
        <LogoutButton />
      </div>

      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* 1. Summary Cards (ดีไซน์กระจกใสแบบพรีเมียม) */}
        <div className={`grid grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-5`}>
          
          <Link href="/students" className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden">
            <div className="absolute -right-6 -top-6 text-8xl opacity-5 group-hover:scale-110 transition-transform duration-500">👨‍🎓</div>
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-600 rounded-2xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform shadow-inner">👨‍🎓</div>
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">นักเรียนทั้งหมด</p>
            <p className="text-4xl font-black text-gray-800 mt-1 tracking-tight">{stats.studentCount}</p>
          </Link>

          <Link href="/courses" className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden">
            <div className="absolute -right-6 -top-6 text-8xl opacity-5 group-hover:scale-110 transition-transform duration-500">📚</div>
            <div className="w-14 h-14 bg-gradient-to-br from-pink-50 to-rose-50 text-pink-600 rounded-2xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform shadow-inner">📚</div>
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">คอร์สเรียน</p>
            <p className="text-4xl font-black text-gray-800 mt-1 tracking-tight">{stats.courseCount}</p>
          </Link>

          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all">
             <div className="absolute -right-6 -top-6 text-8xl opacity-5">🏫</div>
             <div className="w-14 h-14 bg-gradient-to-br from-green-50 to-emerald-50 text-green-600 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-inner">🏫</div>
             <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">มาเรียนวันนี้</p>
             <p className="text-4xl font-black text-gray-800 mt-1 tracking-tight">{stats.todayCheckinCount}</p> 
          </div>

          {isAdmin && (
            <div className="bg-gradient-to-br from-orange-500 to-amber-500 p-6 rounded-[2rem] shadow-lg shadow-orange-200 border border-orange-400 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 text-white">
               <div className="absolute -right-4 -bottom-4 opacity-20 text-8xl group-hover:scale-110 transition-transform duration-500">💰</div>
               <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-inner border border-white/30">💰</div>
               <p className="text-orange-100 text-[10px] font-black uppercase tracking-widest drop-shadow-sm">ยอดขายเดือนนี้</p>
               <p className="text-4xl font-black mt-1 tracking-tight drop-shadow-md">฿ -</p>
            </div>
          )}
        </div>

        {/* 2. สถิติแยกตามระดับชั้น */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
            <h3 className="text-xl font-black text-gray-800 mb-8 flex items-center gap-3 tracking-wide">
                <span className="text-2xl">📊</span> สถิติการเข้าเรียนแยกตามระดับชั้น
            </h3>
            {stats.levelSummary.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-5">
                    {stats.levelSummary.map((item, index) => (
                        <div key={index} className="flex flex-col items-center justify-center p-6 rounded-3xl bg-gray-50 border border-gray-100 hover:bg-white hover:shadow-lg hover:-translate-y-1 hover:border-indigo-100 transition-all duration-300">
                            <span className="text-xs text-gray-400 font-bold mb-1 uppercase tracking-wider">{item.name}</span>
                            <span className="text-4xl font-black text-indigo-600 mb-1">{item.count}</span>
                            <span className="text-[10px] text-gray-400 font-medium">นักเรียน</span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-14 text-gray-400 italic bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                    <p className="text-5xl mb-4 opacity-40">😴</p>
                    <p className="font-bold text-gray-500">ยังไม่มีข้อมูลการเข้าเรียนในวันนี้</p>
                </div>
            )}
        </div>

        {/* 3. Quick Actions เมนูด่วน (ปรับปรุง Grid & เพิ่มปุ่มเช็คชื่อเคาน์เตอร์) */}
        <div>
          <h3 className="text-xl font-black text-gray-800 mb-6 px-1 tracking-wide flex items-center gap-2">
            🚀 จัดการระบบด่วน
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            
            {/* 1. ตารางสอน */}
            <Link href="/timetable" className="group bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-[2rem] shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-1 transition-all flex items-center gap-4 text-white relative overflow-hidden">
              <div className="absolute -right-4 -top-4 opacity-10 text-7xl group-hover:scale-110 transition-transform">🗓️</div>
              <span className="text-2xl bg-white/20 backdrop-blur-sm w-14 h-14 flex items-center justify-center rounded-2xl group-hover:scale-110 transition-transform border border-white/30 z-10">🗓️</span>
              <div className="z-10">
                <p className="font-black text-lg">ตารางสอน</p>
                <p className="text-[10px] text-indigo-100 uppercase font-bold tracking-widest mt-0.5">Class Timetable</p>
              </div>
            </Link>

            {/* 2. สแกนเข้าเรียน (QR) */}
            <Link href="/scan" className="group bg-white border border-gray-100 p-6 rounded-[2rem] shadow-sm hover:shadow-xl hover:border-green-300 hover:-translate-y-1 transition-all flex items-center gap-4">
              <span className="text-2xl bg-green-50 text-green-600 w-14 h-14 flex items-center justify-center rounded-2xl group-hover:scale-110 transition-transform">📷</span>
              <div>
                <p className="font-black text-gray-800 group-hover:text-green-600 transition-colors">สแกนเข้าเรียน</p>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mt-0.5">QR Check-in</p>
              </div>
            </Link>

            {/* ✅ 3. NEW: เช็คชื่อเคาน์เตอร์ (พิมพ์ชื่อ) */}
            <Link href="/checkin" className="group bg-white border border-gray-100 p-6 rounded-[2rem] shadow-sm hover:shadow-xl hover:border-cyan-300 hover:-translate-y-1 transition-all flex items-center gap-4">
              <span className="text-2xl bg-cyan-50 text-cyan-600 w-14 h-14 flex items-center justify-center rounded-2xl group-hover:scale-110 transition-transform">🛎️</span>
              <div>
                <p className="font-black text-gray-800 group-hover:text-cyan-600 transition-colors">เช็คชื่อเคาน์เตอร์</p>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mt-0.5">Manual Check-in</p>
              </div>
            </Link>
            
            {/* 4. ตัดชั่วโมงเรียน */}
            {(user.role === 'teacher' || isAdmin) && (
              <Link href="/class-scan" className="group bg-white border border-gray-100 p-6 rounded-[2rem] shadow-sm hover:shadow-xl hover:border-orange-300 hover:-translate-y-1 transition-all flex items-center gap-4">
                <span className="text-2xl bg-orange-50 text-orange-600 w-14 h-14 flex items-center justify-center rounded-2xl group-hover:scale-110 transition-transform">✂️</span>
                <div>
                  <p className="font-black text-gray-800 group-hover:text-orange-600 transition-colors">ตัดชั่วโมงเรียน</p>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mt-0.5">Deduct Hours</p>
                </div>
              </Link>
            )}

            {/* 5. ลงทะเบียนใหม่ */}
            {(user.role === 'staff' || isAdmin) && (
              <Link href="/register" className="group bg-white border border-gray-100 p-6 rounded-[2rem] shadow-sm hover:shadow-xl hover:border-blue-300 hover:-translate-y-1 transition-all flex items-center gap-4">
                <span className="text-2xl bg-blue-50 text-blue-600 w-14 h-14 flex items-center justify-center rounded-2xl group-hover:scale-110 transition-transform">📝</span>
                <div>
                  <p className="font-black text-gray-800 group-hover:text-blue-600 transition-colors">ลงทะเบียนใหม่</p>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mt-0.5">New Enrollment</p>
                </div>
              </Link>
            )}

            {/* 6. รายชื่อนักเรียน */}
            <Link href="/students" className="group bg-white border border-gray-100 p-6 rounded-[2rem] shadow-sm hover:shadow-xl hover:border-purple-300 hover:-translate-y-1 transition-all flex items-center gap-4">
              <span className="text-2xl bg-purple-50 text-purple-600 w-14 h-14 flex items-center justify-center rounded-2xl group-hover:scale-110 transition-transform">📋</span>
              <div>
                <p className="font-black text-gray-800 group-hover:text-purple-600 transition-colors">รายชื่อนักเรียน</p>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mt-0.5">Student Directory</p>
              </div>
            </Link>

            {/* 7. จัดการคุณครู */}
            {isAdmin && (
              <Link href="/teachers" className="group bg-white border border-gray-100 p-6 rounded-[2rem] shadow-sm hover:shadow-xl hover:border-rose-300 hover:-translate-y-1 transition-all flex items-center gap-4">
                <span className="text-2xl bg-rose-50 text-rose-600 w-14 h-14 flex items-center justify-center rounded-2xl group-hover:scale-110 transition-transform">👨‍🏫</span>
                <div>
                  <p className="font-black text-gray-800 group-hover:text-rose-600 transition-colors">จัดการคุณครู</p>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mt-0.5">Teachers</p>
                </div>
              </Link>
            )}

          </div>
        </div>

        {/* 4. Recent Activity ใครเพิ่งมาถึงบ้าง */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h3 className="text-xl font-black text-gray-800 flex items-center gap-3 tracking-wide">
                <span className="text-2xl">🕒</span> ประวัติเข้าเรียนล่าสุด
            </h3>
            <Link href="/scan" className="text-[10px] text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-full font-black uppercase tracking-widest transition-colors border border-transparent hover:border-indigo-100">
                ดูทั้งหมด →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {stats.recentLogs.length > 0 ? (
              stats.recentLogs.map((log: any) => (
                <Link href={`/students/${log.students?.student_id}`} key={log.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                  <div className="flex items-center gap-5">
                    <div className="relative">
                        {log.students?.image_url ? (
                            <img src={log.students.image_url} alt={log.students.name} className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md group-hover:scale-105 transition-transform" />
                        ) : (
                            <div className="w-16 h-16 bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-2xl shadow-inner border border-indigo-100 group-hover:scale-105 transition-transform">
                                {log.students?.nickname ? log.students.nickname.charAt(0) : log.students?.name?.charAt(0) || '?'}
                            </div>
                        )}
                        <span className="absolute -bottom-1.5 -right-1.5 w-5 h-5 bg-green-500 border-[3px] border-white rounded-full shadow-sm"></span>
                    </div>
                    <div>
                      <p className="text-base font-black text-gray-800 group-hover:text-indigo-600 transition-colors">
                        {log.students?.name}
                        {log.students?.nickname && <span className="text-gray-400 font-bold ml-1">({log.students.nickname})</span>}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                          {log.students?.level && <span className="text-[10px] bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 text-indigo-600 font-black">{log.students.level}</span>}
                          <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                              <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                              บันทึกเวลาสำเร็จ
                          </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black text-gray-800">
                      {new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                    </p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">{timeAgo(log.created_at)}</p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="py-20 text-center">
                  <div className="text-6xl mb-4 opacity-20">🏫</div>
                  <p className="text-gray-400 text-sm font-bold">ยังไม่มีข้อมูลการเช็คชื่อในวันนี้</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}