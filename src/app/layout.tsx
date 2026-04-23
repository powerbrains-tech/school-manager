import type { Metadata, Viewport } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";

// ✅ 1. ตั้งค่าฟอนต์ภาษาไทยให้โหลดเร็วและสวยงาม (ลดการกระตุก)
const prompt = Prompt({
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  subsets: ["latin", "thai"],
  display: 'swap',
});

// ✅ 2. ตั้งค่า Metadata ให้ดูเป็นแอปมืออาชีพเวลาแชร์ลิงก์
export const metadata: Metadata = {
  title: "School Manager | ระบบจัดการโรงเรียนกวดวิชา",
  description: "ระบบจัดการตารางสอน เช็คชื่อ และข้อมูลนักเรียน",
  applicationName: "School Manager",
};

// ✅ 3. ล็อคหน้าจอไม่ให้ iPhone ซูมมั่ว และตั้งสีขอบเบราว์เซอร์ด้านบนบนมือถือ
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // 👈 ตัวกันการซูม
  userScalable: false,
  themeColor: '#4f46e5', // สี Indigo-600
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body 
        // ใส่ antialiased ให้ตัวอักษรคมชัด และเปลี่ยนสีแถบคลุมข้อความ (selection) ให้เข้ากับธีม
        className={`${prompt.className} antialiased bg-gray-50 text-gray-900 selection:bg-indigo-100 selection:text-indigo-900 min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}