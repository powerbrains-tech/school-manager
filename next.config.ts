import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // เพิ่มส่วนนี้เข้าไปครับ 👇
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'uctuvlggewabxaqdaufd.supabase.co', // เอา hostname จากรูป Error มาใส่ตรงนี้
        port: '',
        pathname: '/storage/v1/object/public/avatars/**',
      },
    ],
  },
};

export default nextConfig;